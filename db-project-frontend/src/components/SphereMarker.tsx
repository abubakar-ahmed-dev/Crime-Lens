interface SphereMarkerProps {
  diameter?: number;
  bgColor?: string;
}

const SphereMarker = ({
  diameter = 8,
  bgColor = "bg-green-500",
}: SphereMarkerProps) => {
  return (
    <div
      className={`rounded-full ${bgColor}`}
      style={{
        width: `${diameter}px`,
        height: `${diameter}px`,
      }}
    ></div>
  );
};

export default SphereMarker;
