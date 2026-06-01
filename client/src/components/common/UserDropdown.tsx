import React, { useState, useEffect } from 'react';
import type { User } from '../../types/user';
import { listUsersApi } from '../../utils/userApi';
import { Search, Loader2 } from 'lucide-react';

interface UserDropdownProps {
  onSelect: (user: User) => void;
  selectedUserId?: string;
  excludeUserIds?: string[];
  placeholder?: string;
  className?: string;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({
  onSelect,
  selectedUserId,
  excludeUserIds = [],
  placeholder = "Select a user...",
  className = ""
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const lsUsers = await listUsersApi();
        setUsers(lsUsers);
      } catch (error) {
        console.error("Failed to fetch users", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    !excludeUserIds.includes(user.user_id) &&
    (user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  return (
    <div className={`relative ${className}`}>
      <div 
        className="flex items-center justify-between w-full px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50 bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedUser ? "text-gray-900" : "text-gray-500"}>
          {selectedUser ? selectedUser.name : placeholder}
        </span>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-gray-400" />}
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="p-2 sticky top-0 bg-white border-b">
            <input
              type="text"
              className="w-full px-2 py-1 text-sm border rounded-md outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="py-1">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <div
                  key={user.user_id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
                  onClick={() => {
                    onSelect(user);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 italic">No users found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
