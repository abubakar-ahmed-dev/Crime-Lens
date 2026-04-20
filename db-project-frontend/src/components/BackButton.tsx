import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  bgColor?: string; // optional background color (Tailwind or custom)
  borderColor?: string;
  textSize?: string; // Tailwind text size like "text-sm" | "text-base"
  iconSize?: number; // numeric icon size (in px)
}

const BackButton = ({
  bgColor,
  borderColor,
  textSize = "text-base",
  iconSize = 18,
}: BackButtonProps) => {
  return (
    <button
      className={`flex items-center gap-1 text-gray-400 hover:text-gray-500 transition-colors duration-200 rounded-md cursor-pointer ${
        bgColor ? `${bgColor} px-3 py-1` : ""
      } ${borderColor ? `${borderColor} border-2` : ""}`}
    >
      <ArrowLeft size={iconSize} strokeWidth={1.75} />
      <span className={`${textSize}  font-normal`}>Back</span>
    </button>
  );
};

export default BackButton;
