/**
 * AssigneeList — displays a list of users who are eligible for a specific category.
 */
import type { Assignee } from '../../types/category';

interface AssigneeListProps {
  lsAssignees: Assignee[];
}

export default function AssigneeList({ lsAssignees }: AssigneeListProps) {
  if (lsAssignees.length === 0) {
    return <p className="text-sm text-gray-500 cursor-default">No assignees match this category.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm cursor-default">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Name</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Email</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Role</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-700">Department</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {lsAssignees.map((objAssignee) => (
            <tr key={objAssignee.user_id}>
              <td className="px-3 py-2 text-gray-900">{objAssignee.name}</td>
              <td className="px-3 py-2 text-gray-600">{objAssignee.email}</td>
              <td className="px-3 py-2 text-gray-900 capitalize">{objAssignee.role}</td>
              <td className="px-3 py-2 text-gray-600">
                {objAssignee.department_name || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
