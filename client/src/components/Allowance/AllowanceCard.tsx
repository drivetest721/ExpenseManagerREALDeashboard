/**
 * AllowanceCard — displays a single category's allowance details (name, limit,
 * allowed roles, sub-categories, etc.).
 */
import type { Category } from '../../types/category';

interface AllowanceCardProps {
  objCategory: Category;
}

export default function AllowanceCard({ objCategory }: AllowanceCardProps) {
  return (
    <div className="cursor-default">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{objCategory.name}</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-medium text-gray-700">Max Limit:</span>{' '}
          <span className="text-gray-900">₹{objCategory.max_limit.toLocaleString()}</span>
        </div>

        <div>
          <span className="font-medium text-gray-700">Invoice Required:</span>{' '}
          <span className="text-gray-900">{objCategory.requires_invoice ? 'Yes' : 'No'}</span>
        </div>

        <div>
          <span className="font-medium text-gray-700">Approval Required:</span>{' '}
          <span className="text-gray-900">{objCategory.approval_required ? 'Yes' : 'No'}</span>
        </div>

        <div>
          <span className="font-medium text-gray-700">Status:</span>{' '}
          <span className={`font-medium ${objCategory.is_active ? 'text-green-600' : 'text-red-600'}`}>
            {objCategory.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {objCategory.allowed_roles && objCategory.allowed_roles.length > 0 && (
        <div className="mt-3 text-sm">
          <span className="font-medium text-gray-700">Allowed Roles:</span>{' '}
          <span className="text-gray-900">{objCategory.allowed_roles.join(', ')}</span>
        </div>
      )}

      {objCategory.sub_categories && objCategory.sub_categories.length > 0 && (
        <div className="mt-3 text-sm">
          <span className="font-medium text-gray-700">Sub-Categories:</span>{' '}
          <span className="text-gray-900">{objCategory.sub_categories.join(', ')}</span>
        </div>
      )}

      {objCategory.department_ids && objCategory.department_ids.length > 0 && (
        <div className="mt-3 text-sm">
          <span className="font-medium text-gray-700">Scoped to Departments:</span>{' '}
          <span className="text-gray-600">({objCategory.department_ids.length} department(s))</span>
        </div>
      )}
    </div>
  );
}
