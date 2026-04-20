import Verification from "./component/Verification";
import { useSelector } from "react-redux";
import { type RootState } from "../../store";

// interface VerificationPageProps {
//   version?: "admin" | "police" | "user" | null;
// }

// const VerificationPage = ({ version }: VerificationPageProps) => {
//   const role = useSelector((state: RootState) => state.currentRole.role);
const VerificationPage = () => {
  const role = useSelector((state: RootState) => state.currentRole.role);

  return <Verification version={role}/>;
};

export default VerificationPage;
