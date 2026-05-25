'''
Purpose : Cryptographic helpers for the private "Ask" feature.
          Each "Ask" log entry encrypts its message so that only the sender,
          initiator, and owner/admin can decrypt it.

          Uses RSA-OAEP (2048-bit) for key-pair generation and asymmetric
          encryption of the AES session key, then AES-GCM for the message body.
          The `cryptography` package ships with python-jose and is already installed.

Inputs  : Plain-text ask messages or ciphertext blobs.

Output  : Base64-encoded ciphertext / plain-text strings, RSA PEM keys.

Dependencies: cryptography
'''

import base64
import logging
import os
from typing import Tuple

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

objLogger = logging.getLogger(__name__)

# RSA key size; 2048 is sufficient for encrypting a short AES key.
_RSA_KEY_BITS = 2048
_AES_KEY_BYTES = 32   # AES-256


def generateAskKeyPair() -> Tuple[str, str]:
    """
    Purpose : Generate an RSA-2048 key pair for a new user in the Ask system.
              The private key is stored server-side per user; the public key is
              used to encrypt Ask messages targeted at that user.

    Inputs  : None

    Output  : Tuple (strPrivatePem, strPublicPem) — PEM-encoded strings.

    Example : strPriv, strPub = generateAskKeyPair()
    """
    objPrivKey = rsa.generate_private_key(
        public_exponent=65537,
        key_size=_RSA_KEY_BITS,
    )
    strPrivatePem = objPrivKey.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    strPublicPem = objPrivKey.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return strPrivatePem, strPublicPem


def encryptAskMessage(strMessage: str, strPublicPem: str) -> str:
    """
    Purpose : Encrypt a plain-text Ask message using the recipient's RSA public key.
              Internally uses RSA-OAEP to encrypt a random AES-256 key, then
              AES-GCM to encrypt the message body.  Both are concatenated and
              Base64-encoded for storage.

    Inputs  :   (1) strMessage   : Plain-text message to encrypt (str).
                (2) strPublicPem : Recipient's PEM-encoded RSA public key (str).

    Output  : Base64-encoded ciphertext blob (str).

    Example : strCipher = encryptAskMessage("Invoice missing", strPublicPem)
    """
    objPublicKey = serialization.load_pem_public_key(strPublicPem.encode("utf-8"))

    # Generate a fresh AES-256 session key + nonce
    bytesAesKey = os.urandom(_AES_KEY_BYTES)
    bytesNonce = os.urandom(12)     # 96-bit nonce for GCM

    # Encrypt the message with AES-GCM
    objAesGcm = AESGCM(bytesAesKey)
    bytesCipherText = objAesGcm.encrypt(bytesNonce, strMessage.encode("utf-8"), None)

    # Encrypt the AES key with RSA-OAEP
    bytesEncryptedKey = objPublicKey.encrypt(
        bytesAesKey,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # Pack: [2-byte key length][encrypted AES key][12-byte nonce][AES-GCM ciphertext]
    iKeyLen = len(bytesEncryptedKey)
    bytesBlob = iKeyLen.to_bytes(2, "big") + bytesEncryptedKey + bytesNonce + bytesCipherText
    return base64.b64encode(bytesBlob).decode("utf-8")


def decryptAskMessage(strCiphertext: str, strPrivatePem: str) -> str:
    """
    Purpose : Decrypt an Ask message ciphertext blob using the recipient's RSA private key.

    Inputs  :   (1) strCiphertext : Base64-encoded ciphertext blob produced by encryptAskMessage.
                (2) strPrivatePem : PEM-encoded RSA private key (str).

    Output  : Decrypted plain-text message (str).

    Example : strMsg = decryptAskMessage(strStoredCipher, strUserPrivKey)
    """
    objPrivKey = serialization.load_pem_private_key(
        strPrivatePem.encode("utf-8"), password=None
    )

    bytesBlob = base64.b64decode(strCiphertext.encode("utf-8"))
    iKeyLen = int.from_bytes(bytesBlob[:2], "big")
    bytesEncryptedKey = bytesBlob[2 : 2 + iKeyLen]
    bytesNonce = bytesBlob[2 + iKeyLen : 2 + iKeyLen + 12]
    bytesCipherText = bytesBlob[2 + iKeyLen + 12 :]

    # Decrypt AES key
    bytesAesKey = objPrivKey.decrypt(
        bytesEncryptedKey,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # Decrypt message
    objAesGcm = AESGCM(bytesAesKey)
    return objAesGcm.decrypt(bytesNonce, bytesCipherText, None).decode("utf-8")
