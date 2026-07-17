type SectionWrapperProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
};

const SectionWrapper = ({ children, className = "", id }: SectionWrapperProps) => {
  return (
    <section
      id={id}
      className={`px-6 md:px-12 lg:px-24 py-20 md:py-28 lg:py-32 ${className}`}
    >
      {children}
    </section>
  );
};

export default SectionWrapper;
