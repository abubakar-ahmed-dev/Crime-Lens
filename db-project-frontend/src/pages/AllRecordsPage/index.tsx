// AllRecordsPage/index.tsx
import AllRecords from "./component/AllRecords";
import { type RootState } from "../../store";
import { useSelector } from "react-redux";



// interface AllRecordsProps {
//   version?: "admin" | "police" | "user" | null;
// }

// const AllRecordsPage = ({ version }: AllRecordsProps) => {
//   const role = useSelector((state: RootState) => state.currentRole.role);
const AllRecordsPage = () => {
  const role = useSelector((state: RootState) => state.currentRole.role);

  return (

      <AllRecords version={role} />

  );
};

export default AllRecordsPage;
