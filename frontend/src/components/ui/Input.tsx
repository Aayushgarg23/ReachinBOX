import clsx from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-gray-500">
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          "border rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-colors",
          "focus:border-green-400 focus:ring-1 focus:ring-green-400/30",
          error ? "border-red-400" : "border-gray-200 bg-gray-50",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
