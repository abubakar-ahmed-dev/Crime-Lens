import { useEffect } from "react";
import { setRole } from "../../store/features/current_role";
import Home from "./component/Home";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";


const HomePage = () => {
  const dispatch = useDispatch();
  const { role } = useSelector((state: any) => state.currentRole);

  useEffect(() => {
    console.log(role)
    dispatch(setRole("user"));
    console.log(role);
  }, [role]);
  
  return <Home />;
};

export default HomePage;
