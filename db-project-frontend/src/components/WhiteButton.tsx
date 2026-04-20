type WhiteButtonProps = {
  label: string;
  width?: number;
  height?: number;
  onClick?: () => void;
  rounded?: string;
  fullWidth?: boolean;
};

const WhiteButton = ({ label, width, height, onClick, fullWidth }: WhiteButtonProps) => {
  return (
    <button
      onClick={onClick}
      style={{ width: fullWidth ? undefined : width, height }}
      className={`bg-[#ffffff] rounded-4xl border-2 border-[#237E54] font-outfit font-medium py-2 px-5 items-center text-[#237E54] text-sm hover:bg-[#ebedec] cursor-pointer ${fullWidth ? "w-full" : ""}`}
    >
      {label}
    </button>
  );
};

export default WhiteButton;