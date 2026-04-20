import ReportCrimeCard from "./ReportCrimeCard";


export default function ReportCrime() {


  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        {/* Top section with title and button */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start w-full">
            <div className="flex flex-col gap-y-2">
              <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                Report Crime
              </div>
              <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                Submit details of a crime incident directly to the police
                station corresponding to the zone of crime for verification.
              </div>
            </div>
          </div>
        </div>

        {/* Submit Crime Report Section */}
        <div className="p-4 sm:p-6 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex justify-stretch">
          <ReportCrimeCard />
        </div>
      </div>
    </section>
  );
}
