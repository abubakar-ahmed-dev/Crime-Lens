
// VerificationPage/components/ConfirmationPopup.tsx
import { useState } from "react";
import WhiteButton from "../../../components/WhiteButton";

interface ConfirmationPopupProps {
  version: "admin" | "police";
  isOpen: boolean;
  onClose: () => void;

  requestId?: string | number;
  branchId?: string;
  branchContact?: string;
  username?: string;
  password?: string;
  requestDate?: string;

  title?: string;
  submissionId?: string | number;
  fullName?: string;
  contact?: string;
  cnic?: string;
  crimeType?: string;
  description?: string;
  date?: string;
  zone?: number;
  address?: string;

  onApprove?: (updatedData: any) => void;
  onReject?: () => void;
}

export default function ConfirmationPopup({
  version,
  isOpen,
  onClose,
  onApprove,
  onReject,
  ...initialData
}: ConfirmationPopupProps) {
  const [formData, setFormData] = useState({
    branchId: initialData.branchId || "",
    branchContact: initialData.branchContact || "",
    username: initialData.username || "",
    password: initialData.password || "",
    requestDate: initialData.requestDate || "",
    title: initialData.title || "",
    fullName: initialData.fullName || "",
    contact: initialData.contact || "",
    cnic: initialData.cnic || "",
    crimeType: initialData.crimeType || "",
    description: initialData.description || "",
    date: initialData.date || "",
    zone: initialData.zone || "",
    address: initialData.address || "",
    latitude: "",
    longitude: "",
  });

  // 🆕 Error States Added
  const [latError, setLatError] = useState("");
  const [longError, setLongError] = useState("");

  if (!isOpen) return null;

  // 🆕 Updated handleInputChange WITH RANGE VALIDATION
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Validate Latitude
    if (name === "latitude") {
      const num = Number(value);
      if (num < 23 || num > 26) {
        setLatError("Latitude must be between 23 and 26");
      } else {
        setLatError("");
      }
    }

    // Validate Longitude
    if (name === "longitude") {
      const num = Number(value);
      if (num < 65 || num > 68) {
        setLongError("Longitude must be between 65 and 68");
      } else {
        setLongError("");
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (latError || longError) return; // prevent submit if invalid
    onApprove?.(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 backdrop-blur-sm">
      <div className="bg-white w-[520px] pb-0 pl-6 pr-6 pt-0 rounded-2xl shadow-xl animate-fadeIn font-outfit max-h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-6 pt-6 sticky top-0 bg-white pb-3">
          {version === "admin"
            ? "Confirm Agent Request Details"
            : "Confirm Crime Report Details"}
        </h2>

        <div className="flex flex-col gap-4">
          {version === "admin" ? (
            <>
             <div className="bg-gray-50 p-4 rounded-lg">
                 <label className="text-sm font-medium text-gray-700">
                   Branch ID
                 </label>
                 <input
                  type="text"
                  name="branchId"
                  onChange={handleInputChange}
                  value={formData.branchId}
                  className="inputBox bg-gray-100 mt-1"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-700">
                  Branch Contact #
                </label>
                <input
                  type="text"
                  value={formData.branchContact}
                  name="branchContact"
                  onChange={handleInputChange}
                  className="inputBox bg-gray-100 mt-1"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  name="username"
                  onChange={handleInputChange}
                  className="inputBox bg-gray-100 mt-1"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="text"
                  value={formData.password}
                  name="password"
                  onChange={handleInputChange}
                  className="inputBox bg-gray-100 mt-1"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-700">
                  Request Date
                </label>
                <input
                  type="text"
                  value={formData.requestDate}
                  name="requestDate"
                  onChange={handleInputChange}
                  className="inputBox bg-gray-100 mt-1"
                />
              </div>
            </>
          ) : (
            /* POLICE VERSION - Some Fields Editable */
            <>
              <div className="border-b pb-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Personal Info
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      name="fullName"
                      onChange={handleInputChange}
                      className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
                    />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-700">
                      CNIC
                    </label>
                    <input
                      type="text"
                      value={formData.cnic}
                      name="cnic"
                      onChange={handleInputChange}
                      className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
                    />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-700">
                      Contact #
                    </label>
                    <input
                      type="text"
                      value={formData.contact}
                      name="contact"
                      onChange={handleInputChange}
                      className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
                    />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-700">
                      Zone #
                    </label>
                    <input
                      type="text"
                      value={formData.zone}
                      name="zone"
                      onChange={handleInputChange}
                      className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
                    />
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Crime Info
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-700">
                      Crime Type
                    </label>
                    <input
                      type="text"
                      value={formData.crimeType}
                      name="crimeType"
                      onChange={handleInputChange}
                      className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
                    />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-700">
                      Date
                    </label>
                    <input
                      type="text"
                      value={formData.date}
                      name="date"
                      onChange={handleInputChange}
                      className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <label className="text-xs font-medium text-gray-700">
                    Title
                  </label>
                  <textarea
                    value={formData.title}
                    name="title"
                  onChange={handleInputChange}
                    className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border h-20 resize-none"
                  />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <label className="text-xs font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    name="description"
                  onChange={handleInputChange}
                    className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border h-20 resize-none"
                  />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <label className="text-xs font-medium text-gray-700">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    name="address"
                  onChange={handleInputChange}
                    className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border h-20 resize-none"
                  />
                </div>
              </div>

              <div className="border-b pb-4 bg-blue-50 p-3 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">
                  ✏️ Officer Additions
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* LATITUDE */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Latitude <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      placeholder="23.0001"
                      className="inputBox mt-1"
                    />
                    {latError && (
                      <p className="text-red-600 text-xs mt-1">{latError}</p>
                    )}
                  </div>

                  {/* LONGITUDE */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Longitude <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      placeholder="65.0001"
                      className="inputBox mt-1"
                    />
                    {longError && (
                      <p className="text-red-600 text-xs mt-1">{longError}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-center mt-6 pb-6 gap-3 sticky bottom-0 bg-white pt-4">
          <WhiteButton label="Cancel" width={150} height={45} onClick={onClose} />

          {/* Disable Approve if errors exist */}
          <button
            onClick={handleSubmit}
            disabled={!!latError || !!longError}
            className="px-6 py-1 bg-linear-to-r from-[#145332] to-[#237E54] border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            style={{ width: 300, height: 45 }}
          > Approve </button>
        </div>

      {/* Styling */}
      <style>{`
        .inputBox {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1.5px solid #d0d0d0;
          font-size: 14px;
          font-family: inherit;
        }
        .textareaBox {
          width: 100%;
          height: 80px;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1.5px solid #d0d0d0;
          font-size: 14px;
          font-family: inherit;
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      </div>
    </div>
  );
}
