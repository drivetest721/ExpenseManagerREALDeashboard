'''
Purpose : HTML template generator for reimbursement notifications.
          Generates rich, color-coded notification templates for different reimbursement lifecycle events.

Inputs  : Notification metadata dictionary with reimbursement details.

Output  : HTML string for notification display.

Dependencies: None (pure template generation)
'''

import logging
from typing import Dict, List, Optional
from datetime import datetime

objLogger = logging.getLogger(__name__)


class NotificationTemplates:
    """
    Purpose : Generate HTML templates for reimbursement notifications.
    
    Each template is color-coded according to notification type:
    - Submitted: Blue (#3B82F6)
    - Query: Yellow (#EAB308)
    - Ask: Amber (#F59E0B)
    - Approved: Green (#10B981)
    - Paid: Emerald (#059669)
    - Rejected: Red (#EF4444)
    """
    
    # Base CSS styles for all notification cards
    BASE_STYLES = """
    <style>
        .notification-card {
            border-left: 4px solid;
            padding: 16px;
            border-radius: 8px;
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.5;
        }
        .notification-card h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
            font-weight: 600;
        }
        .notification-card p {
            margin: 6px 0;
            font-size: 14px;
        }
        .notification-card strong {
            font-weight: 600;
            color: #1F2937;
        }
        .notification-card table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 13px;
        }
        .notification-card th, .notification-card td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #E5E7EB;
        }
        .notification-card th {
            background: #F9FAFB;
            font-weight: 600;
        }
        .status-submitted {
            border-color: #3B82F6;
            background: linear-gradient(to right, #EFF6FF, #DBEAFE);
        }
        .status-query {
            border-color: #EAB308;
            background: linear-gradient(to right, #FEFCE8, #FEF3C7);
        }
        .status-ask {
            border-color: #F59E0B;
            background: linear-gradient(to right, #FFFBEB, #FED7AA);
        }
        .status-approved {
            border-color: #10B981;
            background: linear-gradient(to right, #ECFDF5, #D1FAE5);
        }
        .status-paid {
            border-color: #059669;
            background: linear-gradient(to right, #F0FDF4, #DCFCE7);
        }
        .status-rejected {
            border-color: #EF4444;
            background: linear-gradient(to right, #FEF2F2, #FEE2E2);
        }
        .action-required {
            margin-top: 12px;
            padding: 8px;
            background: #FEF3C7;
            border-radius: 4px;
            font-weight: 500;
            color: #92400E;
        }
    </style>
    """
    
    @staticmethod
    def _format_date(strDate: str) -> str:
        """
        Purpose : Format ISO date string to readable format.
        
        Inputs  :   (1) strDate : ISO date string (str)
        
        Output  : Formatted date string (e.g., "13 Jun 2026, 10:30 AM")
        
        Example : _format_date("2026-06-13T10:30:00Z") → "13 Jun 2026, 10:30 AM"
        """
        try:
            dt = datetime.fromisoformat(strDate.replace('Z', '+00:00'))
            return dt.strftime("%d %b %Y, %I:%M %p")
        except:
            return strDate
    
    @staticmethod
    def _format_amount(fAmount: float) -> str:
        """
        Purpose : Format amount with currency symbol.
        
        Inputs  :   (1) fAmount : Amount value (float)
        
        Output  : Formatted amount string (e.g., "₹15,450.00")
        
        Example : _format_amount(15450.50) → "₹15,450.50"
        """
        return f"₹{fAmount:,.2f}"
    
    @staticmethod
    def submitted_to_initiator(dictData: Dict) -> str:
        """
        Purpose : Generate template for initiator when reimbursement is submitted.
        
        Inputs  :   (1) dictData : Notification metadata (dict)
                        - reimbursement_id: Reimbursement ID
                        - initiator_name: Applicant name
                        - categories: List of categories
                        - total_amount: Total amount
                        - submission_date: Submission timestamp
        
        Output  : HTML string for notification
        
        Example : submitted_to_initiator({...}) → "<div>...</div>"
        """
        strReimbId = dictData.get("reimbursement_id", "")
        strInitiatorName = dictData.get("initiator_name", "")
        lsCategories = dictData.get("categories", [])
        fTotalAmount = dictData.get("total_amount", 0.0)
        strSubmissionDate = dictData.get("submission_date", "")
        
        strCategories = ", ".join(lsCategories) if lsCategories else "N/A"
        strAmount = NotificationTemplates._format_amount(fTotalAmount)
        strDate = NotificationTemplates._format_date(strSubmissionDate)
        
        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-submitted">
    <h3>Application Submitted</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Applicant:</strong> {strInitiatorName}</p>
    <p><strong>Categories:</strong> {strCategories}</p>
    <p><strong>Total Amount:</strong> {strAmount}</p>
    <p><strong>Submitted:</strong> {strDate}</p>
</div>
"""

    @staticmethod
    def approval_required(dictData: Dict) -> str:
        """
        Purpose : Generate template for manager when approval is required.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - reimbursement_id, initiator_name, categories,
                          total_amount, submission_date, due_date

        Output  : HTML string for notification
        """
        strReimbId = dictData.get("reimbursement_id", "")
        strInitiatorName = dictData.get("initiator_name", "")
        lsCategories = dictData.get("categories", [])
        fTotalAmount = dictData.get("total_amount", 0.0)
        strSubmissionDate = dictData.get("submission_date", "")
        strDueDate = dictData.get("due_date", "")

        strCategories = ", ".join(lsCategories) if lsCategories else "N/A"
        strAmount = NotificationTemplates._format_amount(fTotalAmount)
        strSubmitted = NotificationTemplates._format_date(strSubmissionDate)
        strDue = NotificationTemplates._format_date(strDueDate)

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-submitted">
    <h3>Approval Required</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Applicant:</strong> {strInitiatorName}</p>
    <p><strong>Categories:</strong> {strCategories}</p>
    <p><strong>Total Amount:</strong> {strAmount}</p>
    <p><strong>Submitted:</strong> {strSubmitted}</p>
    <p><strong>Due Date:</strong> {strDue}</p>
</div>
"""

    @staticmethod
    def approval_required_with_history(dictData: Dict) -> str:
        """
        Purpose : Generate template for escalated approvals with approval history.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - reimbursement_id, initiator_name, categories,
                          total_amount, submission_date, due_date,
                          approval_history: List of {reviewer_name, received_date, approved_date}

        Output  : HTML string for notification
        """
        strReimbId = dictData.get("reimbursement_id", "")
        strInitiatorName = dictData.get("initiator_name", "")
        lsCategories = dictData.get("categories", [])
        fTotalAmount = dictData.get("total_amount", 0.0)
        strSubmissionDate = dictData.get("submission_date", "")
        strDueDate = dictData.get("due_date", "")
        lsHistory = dictData.get("approval_history", [])

        strCategories = ", ".join(lsCategories) if lsCategories else "N/A"
        strAmount = NotificationTemplates._format_amount(fTotalAmount)
        strSubmitted = NotificationTemplates._format_date(strSubmissionDate)
        strDue = NotificationTemplates._format_date(strDueDate)

        # Build history table
        strHistoryRows = ""
        for dictEntry in lsHistory:
            strReviewer = dictEntry.get("reviewer_name", "")
            strReceived = dictEntry.get("received_date", "-")
            strApproved = dictEntry.get("approved_date", "-")

            if strReceived != "-":
                strReceived = NotificationTemplates._format_date(strReceived)
            if strApproved != "-":
                strApproved = NotificationTemplates._format_date(strApproved)

            strHistoryRows += f"""
        <tr>
            <td>{strReviewer}</td>
            <td>{strReceived}</td>
            <td>{strApproved}</td>
        </tr>"""

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-submitted">
    <h3>Approval Required</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Applicant:</strong> {strInitiatorName}</p>
    <p><strong>Categories:</strong> {strCategories}</p>
    <p><strong>Total Amount:</strong> {strAmount}</p>
    <p><strong>Submitted:</strong> {strSubmitted}</p>
    <p><strong>Due Date:</strong> {strDue}</p>

    <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Approval History</h4>
        <table>
            <tr>
                <th>Reviewer</th>
                <th>Received</th>
                <th>Approved</th>
            </tr>{strHistoryRows}
        </table>
    </div>
</div>
"""

    @staticmethod
    def query_raised(dictData: Dict) -> str:
        """
        Purpose : Generate template when manager raises a query.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - manager_name, reimbursement_id, query_message, due_date

        Output  : HTML string for notification
        """
        strManagerName = dictData.get("manager_name", "Manager")
        strReimbId = dictData.get("reimbursement_id", "")
        strQuery = dictData.get("query_message", "")
        strDueDate = dictData.get("due_date", "")

        strDue = NotificationTemplates._format_date(strDueDate)

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-query">
    <h3>Query Raised by {strManagerName}</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Query:</strong> {strQuery}</p>
    <p><strong>Due Date:</strong> {strDue}</p>
</div>
"""

    @staticmethod
    def private_ask(dictData: Dict) -> str:
        """
        Purpose : Generate template for private ask from manager.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - manager_name, reimbursement_id, ask_message, due_date

        Output  : HTML string for notification
        """
        strManagerName = dictData.get("manager_name", "Manager")
        strReimbId = dictData.get("reimbursement_id", "")
        strMessage = dictData.get("ask_message", "")
        strDueDate = dictData.get("due_date", "")

        strDue = NotificationTemplates._format_date(strDueDate)

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-ask">
    <h3>Private Message from {strManagerName}</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Message:</strong> {strMessage}</p>
    <p><strong>Due Date:</strong> {strDue}</p>
</div>
"""

    @staticmethod
    def approved(dictData: Dict) -> str:
        """
        Purpose : Generate template when manager approves.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - manager_name, reimbursement_id, total_amount,
                          categories, approved_date

        Output  : HTML string for notification
        """
        strManagerName = dictData.get("manager_name", "Manager")
        strReimbId = dictData.get("reimbursement_id", "")
        fTotalAmount = dictData.get("total_amount", 0.0)
        lsCategories = dictData.get("categories", [])
        strApprovedDate = dictData.get("approved_date", "")

        strCategories = ", ".join(lsCategories) if lsCategories else "N/A"
        strAmount = NotificationTemplates._format_amount(fTotalAmount)
        strDate = NotificationTemplates._format_date(strApprovedDate)

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-approved">
    <h3>Approved by {strManagerName}</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Reviewer:</strong> {strManagerName}</p>
    <p><strong>Total Amount:</strong> {strAmount}</p>
    <p><strong>Categories:</strong> {strCategories}</p>
    <p><strong>Approved:</strong> {strDate}</p>
</div>
"""

    @staticmethod
    def payment_disbursed(dictData: Dict) -> str:
        """
        Purpose : Generate template when payment is disbursed.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - reimbursement_id, total_amount, categories, payment_date

        Output  : HTML string for notification
        """
        strReimbId = dictData.get("reimbursement_id", "")
        fTotalAmount = dictData.get("total_amount", 0.0)
        lsCategories = dictData.get("categories", [])
        strPaymentDate = dictData.get("payment_date", "")

        strCategories = ", ".join(lsCategories) if lsCategories else "N/A"
        strAmount = NotificationTemplates._format_amount(fTotalAmount)
        strDate = NotificationTemplates._format_date(strPaymentDate)

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-paid">
    <h3>Payment Disbursed</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Amount Paid:</strong> {strAmount}</p>
    <p><strong>Categories:</strong> {strCategories}</p>
    <p><strong>Payment Date:</strong> {strDate}</p>
    <p class="action-required">Please acknowledge receipt of payment.</p>
</div>
"""

    @staticmethod
    def rejected(dictData: Dict) -> str:
        """
        Purpose : Generate template when reimbursement is rejected.

        Inputs  :   (1) dictData : Notification metadata (dict)
                        - reimbursement_id, rejection_reason, total_amount,
                          categories, rejected_date

        Output  : HTML string for notification
        """
        strReimbId = dictData.get("reimbursement_id", "")
        strReason = dictData.get("rejection_reason", "")
        fTotalAmount = dictData.get("total_amount", 0.0)
        lsCategories = dictData.get("categories", [])
        strRejectedDate = dictData.get("rejected_date", "")

        strCategories = ", ".join(lsCategories) if lsCategories else "N/A"
        strAmount = NotificationTemplates._format_amount(fTotalAmount)
        strDate = NotificationTemplates._format_date(strRejectedDate)

        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-rejected">
    <h3>Reimbursement Rejected</h3>
    <p><strong>Reimbursement ID:</strong> {strReimbId}</p>
    <p><strong>Reason:</strong> {strReason}</p>
    <p><strong>Total Amount:</strong> {strAmount}</p>
    <p><strong>Categories:</strong> {strCategories}</p>
    <p><strong>Rejected:</strong> {strDate}</p>
</div>
"""

    @staticmethod
    def get_template(strAction: str, dictData: Dict) -> str:
        """
        Purpose : Get appropriate template based on action type.

        Inputs  :   (1) strAction : Action type (str) - SUBMITTED, QUERY, ASK, etc.
                    (2) dictData  : Notification metadata (dict)

        Output  : HTML string for notification

        Example : get_template("SUBMITTED", {...}) → "<div>...</div>"
        """
        dictTemplateMap = {
            "SUBMITTED_INITIATOR": NotificationTemplates.submitted_to_initiator,
            "SUBMITTED_MANAGER": NotificationTemplates.approval_required,
            "APPROVED_ESCALATED": NotificationTemplates.approval_required_with_history,
            "QUERY": NotificationTemplates.query_raised,
            "ASK": NotificationTemplates.private_ask,
            "APPROVED": NotificationTemplates.approved,
            "PAID": NotificationTemplates.payment_disbursed,
            "REJECTED": NotificationTemplates.rejected,
        }

        funcTemplate = dictTemplateMap.get(strAction)
        if funcTemplate:
            return funcTemplate(dictData)

        # Fallback to simple template
        return f"""{NotificationTemplates.BASE_STYLES}
<div class="notification-card status-submitted">
    <h3>Notification</h3>
    <p><strong>Reimbursement ID:</strong> {dictData.get('reimbursement_id', 'N/A')}</p>
    <p>{dictData.get('message', '')}</p>
</div>
"""
