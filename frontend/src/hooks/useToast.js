import toast from "react-hot-toast";
import { useCallback } from "react";

export default function useToast() {
  const showToast = useCallback((message, type = "info") => {
    switch (type) {
      case "success": toast.success(message); break;
      case "error":   toast.error(message);   break;
      case "pending":
        toast.loading(message, { id: "pending" });
        break;
      case "dismiss":
        toast.dismiss("pending");
        break;
      default:
        toast(message);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    toast.dismiss(id);
  }, []);

  const promiseToast = useCallback((promise, messages) => {
    return toast.promise(promise, {
      loading: messages.loading || "Processing…",
      success: messages.success || "Done!",
      error:   messages.error   || "Something went wrong.",
    });
  }, []);

  return { showToast, dismissToast, promiseToast };
}