import LogowithText from "../../../assets/LogowithText.svg";

const FooterSection = () => {
  return (
    <footer className="bg-white border-t border-gray-100 px-6 md:px-12 lg:px-24 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <img
            src={LogowithText}
            alt="CrimeLens Logo"
            className="w-32"
          />
          <div className="text-gray-500 text-sm">
            © {new Date().getFullYear()} CrimeLens. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
