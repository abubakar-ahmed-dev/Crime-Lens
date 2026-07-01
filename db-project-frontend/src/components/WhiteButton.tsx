type WhiteButtonProps = {
  label: string;
  width?: number;
  height?: number;
  onClick?: () => void;
  rounded?: string;
  fullWidth?: boolean;
  disabled?: boolean;
};

const WhiteButton = ({ label, width, height, onClick, fullWidth, disabled }: WhiteButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: fullWidth ? undefined : width, height }}
      className={`bg-[#ffffff] rounded-4xl border-2 border-[#237E54] font-outfit font-medium py-2 px-5 items-center text-[#237E54] text-sm hover:bg-[#ebedec] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""}`}
    >
      {label}
    </button>
  );
};

export default WhiteButton;
