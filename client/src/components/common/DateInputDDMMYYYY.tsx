/**
 * DateInputDDMMYYYY - Modern date picker with DD/MM/YYYY format and green theme
 * Uses react-datepicker library with custom green background styling
 */
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DateInputDDMMYYYYProps {
  value: string; // yyyy-mm-dd format
  onChange: (value: string) => void; // yyyy-mm-dd format
  className?: string;
}

// Render popper into document.body so it escapes overflow-hidden / transformed ancestors
const PopperContainer = ({ children }: { children: React.ReactNode }) => {
  if (typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
};

export default function DateInputDDMMYYYY({ 
  value, 
  onChange, 
  className = ''
}: DateInputDDMMYYYYProps) {
  // Convert yyyy-mm-dd to Date object
  const dateValue = value ? new Date(value + 'T00:00:00') : null;

  const handleDateChange = (date: Date | null) => {
    if (date) {
      // Convert Date to yyyy-mm-dd format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      selected={dateValue}
      onChange={handleDateChange}
      dateFormat="dd/MM/yyyy"
      placeholderText="DD/MM/YYYY"
      className={`w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-[#00703C] cursor-pointer hover:border-[#00703C] hover:shadow-md transition-all shadow-sm font-medium ${className}`}
      showPopperArrow={false}
      popperPlacement="bottom-start"
      popperClassName="green-datepicker-popper"
      calendarClassName="green-datepicker-calendar"
      wrapperClassName="w-full"
      popperContainer={PopperContainer}
    />
  );
}
