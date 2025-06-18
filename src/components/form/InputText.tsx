import React from "react";

interface InputTextProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const InputText: React.FC<InputTextProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
  leftIcon,
  rightIcon,
  type = "text",
  name,
  disabled,
  autoFocus,
  ...rest
}) => {
  return (
    <div
      className={`flex items-center bg-zinc-800 border border-zinc-600 rounded-lg px-3 h-9 ${className}`}>
      {leftIcon && (
        <span className="mr-2 flex items-center text-zinc-400">{leftIcon}</span>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="bg-transparent border-none outline-none text-white w-full text-[15px] placeholder-zinc-400"
        {...rest}
      />
      {rightIcon && (
        <span className="ml-2 flex items-center text-zinc-400">
          {rightIcon}
        </span>
      )}
    </div>
  );
};

export default InputText;
