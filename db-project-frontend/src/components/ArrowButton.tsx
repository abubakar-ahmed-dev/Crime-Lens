import { ArrowUpRight } from "lucide-react";

interface ArrowButtonProps {
  size?: number;
  bgColor?: string;
  iconColor?: string;
  hoverBgColor?: string;
  hoverIconColor?: string;
  onClick?: () => void;
}

const ArrowButton = ({
  size = 40,
  bgColor = "bg-white",
  iconColor = "text-green-600",
  hoverBgColor = "hover:bg-green-100",
  hoverIconColor = "group-hover:text-green-700",
  onClick,
}: ArrowButtonProps) => {
  // Handle both Tailwind and custom hex/RGB color formats
  const getColorValue = (className: string) => {
    if (!className) return "#16a34a"; // fallback
    if (className.startsWith("#") || className.startsWith("rgb")) return className;

    // Tailwind-based lookup
    if (className.includes("green-")) return "#16a34a";
    if (className.includes("blue-")) return "#2563eb";
    if (className.includes("red-")) return "#dc2626";
    if (className.includes("gray-")) return "#6b7280";
    if (className.includes("black")) return "#000000";
    if (className.includes("white")) return "#ffffff";

    return "#16a34a";
  };

  const normalColor = getColorValue(iconColor);
  const hoverColor = getColorValue(hoverIconColor);

  return (
    <button
      onClick={onClick}
      className={`group ${bgColor} ${hoverBgColor} rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: normalColor,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = hoverColor)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = normalColor)}
    >
      <ArrowUpRight
        size={size * 0.45}
        className={`${iconColor} ${hoverIconColor} transition-colors duration-300`}
      />
    </button>
  );
};

export default ArrowButton;
