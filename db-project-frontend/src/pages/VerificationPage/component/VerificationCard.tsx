//VerificationPage/components/VerificationCard.tsx
import { useState } from "react";
import WhiteButton from "../../../components/WhiteButton";
import ConfirmationPopup from "./ConfirmationPopup";

type VerificationCardProps =
  | {
    version: "admin";
    requestId: string | number;
    branchId: string;
    branchContact: string;
    username: string;
    password: string;
    requestDate: string;
    onContact?: () => void;
    onReject?: (reason?: string) => void;
    onApprove?: () => void;
  }
  | {
    version: "police";
    title: string,
    submissionId: string | number;
    fullName: string;
    contact: string;
    cnic: string;
    crimeType: string;
    description: string;
    date: string;
    zone: number;
    address: string;
    onContact?: () => void;
    onReject?: (reason?: string) => void;
    onApprove?: () => void;
  };

export default function VerificationCard(props: VerificationCardProps) {
  const [openConfirm, setOpenConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Copy contact number to clipboard and show snackbar
  const handleContactCopy = async () => {
    const num =
      props.version === "admin"
        ? // @ts-ignore - branchContact exists on admin variant
        (props as any).branchContact
        : // @ts-ignore - contact exists on police variant
        (props as any).contact;

    if (num) {
      try {
        await navigator.clipboard.writeText(num);
      } catch {
        // fallback: create temporary textarea
        const ta = document.createElement("textarea");
        ta.value = num;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    }

    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 2500);

    props.onContact?.();
  };

  // Handle Approve
  const handleApproveSubmit = async (updatedValues: any) => {
    setLoading(true);
    setError("");

    try {
      let endpoint = "";
      let body = {};

      if (props.version === "admin") {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/agent/verify/${props.requestId}`;
        body = { roleId: 2 }; // Default to police officer role
      } else {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/user/approve/${props.submissionId}`;
        body = {
          address: updatedValues.address || "",
          latitude: Number(updatedValues.latitude),
          longitude: Number(updatedValues.longitude),
          title: updatedValues.title || "",
          description: updatedValues.description || "",
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setOpenConfirm(false);
        props.onApprove?.();
      } else {
        setError(result.message || "Failed to approve");
      }
    } catch (err) {
      console.error("Approval Error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Reject
  const handleRejectSubmit = async () => {
    const reason = "";

    setLoading(true);
    setError("");

    try {
      let endpoint = "";

      if (props.version === "admin") {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/agent/reject/${props.requestId}`;
      } else {
        // @ts-ignore
        endpoint = `${API_BASE_URL}/user/reject/${props.submissionId}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowRejectConfirm(false);
        props.onReject?.(reason);
      } else {
        setError(result.message || "Failed to reject");
      }
    } catch (err) {
      console.error("Rejection Error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.08)] p-6 w-full flex flex-col gap-y-3 font-outfit border-2 border-[#e8e8e8] relative">
      {/* Admin Version */}
      {props.version === "admin" ? (
        <>
          <h3 className="font-semibold text-gray-700 mb-2">Agent Info:</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold">Branch ID:</span> {props.branchId}
            </p>
            <p>
              <span className="font-semibold">Branch Contact #:</span>{" "}
              {props.branchContact}
            </p>
            <p>
              <span className="font-semibold">Username:</span> {props.username}
            </p>
            <p>
              <span className="font-semibold">Password:</span> {props.password}
            </p>
            <p>
              <span className="font-semibold">Request Date:</span>{" "}
              {props.requestDate}
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Police Version */}
          <h3 className="font-semibold text-[#7d7d7d]">Personal Info:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold">Full Name:</span> {props.fullName}
            </p>
            <p>
              <span className="font-semibold">CNIC:</span> {props.cnic}
            </p>
            <p>
              <span className="font-semibold">Contact #:</span> {props.contact}
            </p>
          </div>

          <hr className="my-4 border-t-2 border-[#d9d9d9]" />

          <h3 className="font-semibold text-[#7d7d7d]">Crime Info:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold">Title:</span>{" "}
              {props.title || "--"}
            </p>
            <p>
              <span className="font-semibold">Crime Type:</span>{" "}
              {props.crimeType}
            </p>
            <p>
              <span className="font-semibold">Date:</span> {props.date}
            </p>
            <p>
              <span className="font-semibold">Zone #:</span> {props.zone}
            </p>
            <p>
              <span className="font-semibold">Address:</span>{" "}
              {props.address || "--"}
            </p>
            <p>
              <span className="font-semibold">Description:</span>{" "}
              {props.description || "--"}
            </p>
          </div>
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm font-outfit">{error}</p>
        </div>
      )}

      {/* Footer Buttons */}
      <div className="border-t-2 border-[#d9d9d9] mt-4 pt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <WhiteButton
          label="Contact for Verification"
          width={300}
          height={40}
          onClick={handleContactCopy}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowRejectConfirm(true)}
            disabled={loading}
            className="px-6 py-1 bg-[#b80404] hover:bg-red-900 border-2 border-[#b80404] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            style={{ width: 200, height: 40 }}
          >
            {loading ? "Processing..." : "Reject"}
          </button>
          <button
            onClick={() => setOpenConfirm(true)}
            disabled={loading}
            className="px-6 py-1 bg-linear-to-r from-[#145332] to-[#237E54] border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            style={{ width: 200, height: 40 }}
          >
            {loading ? "Processing..." : "Approve"}
          </button>
        </div>
      </div>

      {/* Approve popup */}
      <ConfirmationPopup
        {...props} // contains version and the rest
        isOpen={openConfirm}
        onClose={() => setOpenConfirm(false)} //
        onApprove={(updatedValues) => {
          handleApproveSubmit(updatedValues);
        }}
        onReject={() => {
          setOpenConfirm(false);
        }}
      />

      {/* Reject confirm modal (for main card Reject button) */}
      {showRejectConfirm && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-40 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-[380px] animate-fadeIn">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 flex justify-center">
              Are you sure you want to reject?
            </h3>

            <div className="flex justify-center gap-2">
              <WhiteButton
                label="Cancel"
                width={120}
                height={40}
                onClick={() => setShowRejectConfirm(false)}
              />
              <button
                onClick={() => handleRejectSubmit()}
                disabled={loading}
                className="px-6 py-1 bg-[#b80404] hover:bg-red-900 border-2 border-[#b80404] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
                style={{ width: 120, height: 40 }}
              >
                {loading ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-right white snackbar (slides in/out) */}
      <div
        className={`fixed top-6 right-[-420px] z-50 transition-all duration-500 ease-out`}
        style={{
          right: showSnackbar ? 20 : -420,
        }}
        aria-hidden={!showSnackbar}
      >
        <div
          className="bg-white shadow-[0_0_5px_rgba(0,0,0,0.08)] rounded-xl px-6 py-5 flex flex-col items-center"
          style={{ minWidth: 220 }}
        >
          {/* green circled check */}
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "3px solid #16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
            }}
          >
            {/* simple check svg */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="#16a34a"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="mt-2 text-sm text-gray-800 font-medium">
            Contact No. copied to clipboard.
          </div>
        </div>
      </div>

      {/* minor keyframe for reject modal fade (kept local) */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.18s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
