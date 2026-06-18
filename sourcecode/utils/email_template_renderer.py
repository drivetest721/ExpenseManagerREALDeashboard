'''
Purpose : HTML Email Template Renderer for SLA Events
          Loads HTML templates and renders them with dynamic data.

Inputs  : Template name, data dictionary

Output  : Rendered HTML string

Dependencies: jinja2 (optional), pathlib, datetime
'''

import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Get the templates directory
TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "emails"


def _format_datetime(dt_str: Optional[str]) -> str:
    """Format ISO datetime string to readable format."""
    if not dt_str:
        return "—"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y, %I:%M %p")
    except:
        return dt_str


def _get_status_badge(status: str) -> str:
    """Get colored status badge HTML."""
    status_colors = {
        "SUBMITTED": "#3b82f6",
        "IN_REVIEW": "#f59e0b",
        "APPROVED": "#10b981",
        "REJECTED": "#ef4444",
        "PENDING": "#6b7280",
        "QUERY": "#8b5cf6",
        "PAID": "#059669",
    }
    color = status_colors.get(status, "#6b7280")
    return f'<span style="display: inline-block; padding: 4px 8px; background-color: {color}; color: #ffffff; font-size: 11px; font-weight: 600; border-radius: 4px;">{status}</span>'


def _build_approval_chain_rows(approval_chain: List[Dict], current_step: int) -> str:
    """Build HTML table rows for approval chain history."""
    if not approval_chain:
        return '<tr><td colspan="6" style="padding: 15px; text-align: center; color: #9ca3af; font-size: 13px;">No approval history available</td></tr>'
    
    rows = []
    # Show history up to and including current step
    for node in approval_chain[:current_step + 1]:
        step = node.get("step", 0)
        username = node.get("username", "Unknown")
        role = node.get("role", "—").title()
        received_at = _format_datetime(node.get("receivedAt"))
        submitted_at = _format_datetime(node.get("submittedAt"))
        status = node.get("current_status", "PENDING")
        status_badge = _get_status_badge(status)
        
        # Highlight current reviewer
        row_style = 'background-color: #fef3c7;' if step == current_step else ''
        
        row = f'''
        <tr style="{row_style}">
            <td style="padding: 10px; font-size: 12px; color: #111827; border-bottom: 1px solid #e5e7eb;">
                <strong>Step {step}</strong>
            </td>
            <td style="padding: 10px; font-size: 12px; color: #111827; border-bottom: 1px solid #e5e7eb;">
                {username}
            </td>
            <td style="padding: 10px; font-size: 12px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">
                {role}
            </td>
            <td style="padding: 10px; font-size: 12px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">
                {received_at}
            </td>
            <td style="padding: 10px; font-size: 12px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">
                {submitted_at}
            </td>
            <td style="padding: 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb;">
                {status_badge}
            </td>
        </tr>
        '''
        rows.append(row)
    
    return "\n".join(rows)


def render_template(template_name: str, data: Dict) -> str:
    """
    Purpose : Render an HTML email template with provided data.
    
    Inputs  :   (1) template_name : Template file name (str) e.g., 'sla_auto_rejection_initiator.html'
                (2) data          : Dictionary of template variables (dict)
    
    Output  : Rendered HTML string
    """
    template_path = TEMPLATES_DIR / template_name
    
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")
    
    # Read template
    with open(template_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Add current year if not provided
    if 'current_year' not in data:
        data['current_year'] = datetime.now().year
    
    # Build approval chain rows HTML if approval_chain is provided
    if 'approval_chain' in data:
        approval_chain_html = _build_approval_chain_rows(
            data['approval_chain'], 
            data.get('current_step', 0)
        )
        data['approval_chain_rows'] = approval_chain_html
    
    # Simple template variable replacement
    for key, value in data.items():
        placeholder = f"{{{{ {key} }}}}"
        html_content = html_content.replace(placeholder, str(value))
    
    return html_content


def render_sla_auto_rejection_initiator(
    reimbursement_id: str,
    initiator_name: str,
    department: str,
    initiator_role: str,
    amount: float,
    reviewer_name: str,
    event_type: str,
    approval_chain: List[Dict],
    current_step: int,
) -> str:
    """Render SLA auto-rejection email for initiator."""
    data = {
        'reimbursement_id': reimbursement_id,
        'initiator_name': initiator_name,
        'department': department,
        'initiator_role': initiator_role.title(),
        'amount': f"{amount:,.2f}",
        'reviewer_name': reviewer_name,
        'event_type': event_type,
        'approval_chain': approval_chain,
        'current_step': current_step,
    }
    return render_template('sla_auto_rejection_initiator.html', data)


def render_sla_auto_rejection_reviewer(
    reimbursement_id: str,
    initiator_name: str,
    department: str,
    initiator_role: str,
    amount: float,
    reviewer_name: str,
    event_type: str,
    approval_chain: List[Dict],
    current_step: int,
) -> str:
    """Render SLA auto-rejection email for reviewer."""
    data = {
        'reimbursement_id': reimbursement_id,
        'initiator_name': initiator_name,
        'department': department,
        'initiator_role': initiator_role.title(),
        'amount': f"{amount:,.2f}",
        'reviewer_name': reviewer_name,
        'event_type': event_type,
        'approval_chain': approval_chain,
        'current_step': current_step,
    }
    return render_template('sla_auto_rejection_reviewer.html', data)


def render_sla_reminder(
    reimbursement_id: str,
    initiator_name: str,
    department: str,
    initiator_role: str,
    amount: float,
    reviewer_name: str,
    hours_left: int,
    due_at: str,
    approval_chain: List[Dict],
    current_step: int,
    review_link: str = "#",
) -> str:
    """Render SLA reminder email."""
    data = {
        'reimbursement_id': reimbursement_id,
        'initiator_name': initiator_name,
        'department': department,
        'initiator_role': initiator_role.title(),
        'amount': f"{amount:,.2f}",
        'reviewer_name': reviewer_name,
        'hours_left': hours_left,
        'due_at': _format_datetime(due_at),
        'approval_chain': approval_chain,
        'current_step': current_step,
        'review_link': review_link,
    }
    return render_template('sla_reminder.html', data)
