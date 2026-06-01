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
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-l border-r border-gray-200">Name</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Email</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Role</th>
            <th className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Department</th>
          </tr>
        </thead>
        <tbody>
          {lsAssignees.map((objAssignee) => (
            <tr key={objAssignee.user_id}>
              <td className="px-3 py-2 text-center text-gray-900 border-l border-r border-gray-200">{objAssignee.name}</td>
              <td className="px-3 py-2 text-center text-gray-600 border-r border-gray-200">{objAssignee.email}</td>
              <td className="px-3 py-2 text-center text-gray-900 capitalize border-r border-gray-200">{objAssignee.role}</td>
              <td className="px-3 py-2 text-center text-gray-600 border-r border-gray-200">
                {objAssignee.department_name || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
