import SectionWrapper from "./shared/SectionWrapper";
import { FileText, CheckCircle, BarChart3, Map, TrendingUp, ChevronRight } from "lucide-react";

type WorkflowStepProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
};

const WorkflowStep = ({ icon, title, description, isLast = false }: WorkflowStepProps) => {
  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Icon Circle */}
      <div className="icon-circle mb-6">
        {icon}
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 max-w-[170px]">{description}</p>

      {/* Connector Arrow */}
      {!isLast && (
        <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 -ml-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white">
            <ChevronRight className="w-5 h-5 text-[#237E54]" />
          </div>
        </div>
      )}
    </div>
  );
};

const WorkflowSection = () => {
  return (
    <SectionWrapper className="bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            How CrimeLens works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A simple workflow that turns reports into action
          </p>
        </div>

        {/* Horizontal Workflow */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 md:gap-4 relative px-4">
          <div className="flex-1">
            <WorkflowStep
              icon={<FileText className="w-7 h-7 text-white" />}
              title="Report"
              description="Citizens submit crime reports with details and location"
            />
          </div>

          <div className="flex-1">
            <WorkflowStep
              icon={<CheckCircle className="w-7 h-7 text-white" />}
              title="Validate"
              description="Police verify reports and ensure accuracy"
            />
          </div>

          <div className="flex-1">
            <WorkflowStep
              icon={<BarChart3 className="w-7 h-7 text-white" />}
              title="Analyze"
              description="Data is processed and categorized for insights"
            />
          </div>

          <div className="flex-1">
            <WorkflowStep
              icon={<Map className="w-7 h-7 text-white" />}
              title="Visualize"
              description="Interactive maps and charts reveal patterns"
            />
          </div>

          <div className="flex-1">
            <WorkflowStep
              icon={<TrendingUp className="w-7 h-7 text-white" />}
              title="Take Action"
              description="Communities use insights to improve safety"
              isLast={true}
            />
          </div>
        </div>

        {/* Mobile Vertical Connector */}
        {/* <div className="md:hidden flex flex-col items-center gap-4 mt-8">
          <div className="flex flex-col gap-2 w-full">
            {[
              { label: "Report" },
              { label: "Validate" },
              { label: "Analyze" },
              { label: "Visualize" },
              { label: "Take Action" }
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{item.label}</span>
                {index < 4 && <ChevronRight className="w-5 h-5 text-[#237E54] ml-auto" />}
              </div>
            ))}
          </div>
        </div> */}
      </div>
    </SectionWrapper>
  );
};

export default WorkflowSection;
