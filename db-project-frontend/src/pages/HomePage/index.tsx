import { useEffect } from "react";
import { setRole } from "../../store/features/current_role";
import Home from "./component/Home";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";


const HomePage = () => {
  const dispatch = useDispatch();
  const { role } = useSelector((state: any) => state.currentRole);

  useEffect(() => {
    dispatch(setRole("user"));
  }, [role]);
  
  return <Home />;
};

export default HomePage;
