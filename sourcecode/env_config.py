'''
Purpose : Centralised environment configuration loader for the Expense Management backend.

Inputs  : Reads variables from the local .env file (or process environment).

Output  : Exposes a singleton `objSettings` of type `EnvSettings` consumed across the app.

Dependencies: pydantic-settings, python-dotenv
'''

import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()


class EnvSettings(BaseSettings):
    """
    Purpose : Typed wrapper around required environment variables.

    Inputs  : Values pulled from environment / .env file.

    Output  : Strongly-typed configuration object.

    Example : from env_config import objSettings
              strMongoUrl = objSettings.MONGODB_URL
    """

    APP_NAME: str = Field(default="ExpenseManager", description="Application name")
    APP_ENV: str = Field(default="development", description="dev | staging | production")
    APP_HOST: str = Field(default="0.0.0.0", description="Bind host for uvicorn")
    APP_PORT: int = Field(default=8000, description="Bind port for uvicorn")

    MONGODB_URL: str = Field(default="mongodb://localhost:27017", description="MongoDB connection string")
    MONGODB_DATABASE: str = Field(default="expense_manager", description="MongoDB database name")

    JWT_SECRET_KEY: str = Field(default="change-me-in-production", description="HMAC secret for JWT")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    JWT_EXPIRY_MINUTES: int = Field(default=480, description="Access-token validity (minutes)")

    SMTP_HOST: str = Field(default="", description="SMTP host for outbound mail")
    SMTP_PORT: int = Field(default=587, description="SMTP port")
    SMTP_USERNAME: str = Field(default="", description="SMTP username")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password")
    SMTP_FROM: str = Field(default="no-reply@example.com", description="Default From address")

    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="Comma-separated list of allowed CORS origins",
    )

    ATTACHMENT_MAX_BYTES: int = Field(default=10 * 1024 * 1024, description="Max upload size (10 MB)")

    SLA_APPROVAL_DAYS: int = Field(default=3, description="Default business-day SLA for approvals")
    SLA_QUERY_RESPONSE_DAYS: int = Field(default=2, description="Default business-day SLA for query response")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def lsStrCorsOrigins(self) -> List[str]:
        """
        Purpose : Parse CORS_ORIGINS env string into a list.

        Inputs  : None

        Output  : List of origin URLs.

        Example : lsOrigins = objSettings.lsStrCorsOrigins
        """
        return [strOrigin.strip() for strOrigin in self.CORS_ORIGINS.split(",") if strOrigin.strip()]


objSettings = EnvSettings()
