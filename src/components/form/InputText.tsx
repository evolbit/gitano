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
      className={`flex items-center bg-secondary border border-border rounded-lg px-3 h-9 ${className}`}>
      {leftIcon && (
        <span className="mr-2 flex items-center text-muted-foreground">
          {leftIcon}
        </span>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="bg-transparent border-none outline-none text-foreground w-full text-base placeholder-muted-foreground"
        {...rest}
      />
      {rightIcon && (
        <span className="ml-2 flex items-center text-muted-foreground">
          {rightIcon}
        </span>
      )}
    </div>
  );
};

export default InputText;
