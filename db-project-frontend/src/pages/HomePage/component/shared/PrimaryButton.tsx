import { useNavigate } from "react-router-dom";

type PrimaryButtonProps = {
  label: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  href?: string;
  className?: string;
};

const PrimaryButton = ({
  label,
  variant = "primary",
  onClick,
  href,
  className = ""
}: PrimaryButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      navigate(href);
    }
  };

  const baseStyles = "rounded-4xl font-outfit font-medium py-3 px-8 text-sm transition-all duration-200 cursor-pointer";

  const variantStyles = {
    primary: "bg-gradient-to-r from-[#145332] to-[#237E54] text-white border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] shadow-sm hover:shadow-md",
    secondary: "bg-white text-[#237E54] border-2 border-[#237E54] hover:bg-gray-50"
  };

  return (
    <button
      onClick={handleClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {label}
    </button>
  );
};

export default PrimaryButton;
