type RedButtonProps = {
    label: string;
    width?: number;
    height?: number;
    onClick?: () => void;
    rounded?: string; // NEW optional prop
  };
  
  export default function RedButton({
    label,
    width,
    height,
    onClick,
    rounded = "4xl", // default value
  }: RedButtonProps) {
    return (
      <button
        onClick={onClick}
        style={{ width, height }}
        className={`bg-[#C50303] rounded-${rounded} border-2 border-[#C50303] font-outfit font-normal py-2 px-5 items-center text-white text-sm hover:bg-red-800 cursor-pointer`}
      >
        {label}
      </button>
    );
  }
  
