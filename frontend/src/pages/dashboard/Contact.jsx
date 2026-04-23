import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { submitContact } from "../../api/dashboard";
import DashboardLayout from "../../components/dashboard/DashboardLayout";

export default function Contact() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    try {
      await submitContact({ name: user?.email?.split("@")[0] || "", email: user?.email || "", subject: "Poll Limit Increase Request", message: e.target.message.value });
      setStatus("success");
    } catch { setStatus("error"); }
  }

  if (status === "success") return (
    <DashboardLayout><div className="page-container"><div className="success-message"><h2>Message Sent!</h2><p>We&apos;ll review within 24–48 hours.</p></div></div></DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="page-container">
        <h1>Contact</h1>
        <p className="page-subtitle">Request a poll limit increase</p>
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group"><label>Name</label><input type="text" defaultValue={user?.email?.split("@")[0]} required /></div>
          <div className="form-group"><label>Email</label><input type="email" defaultValue={user?.email} required /></div>
          <div className="form-group"><label>Subject</label><input type="text" defaultValue="Poll Limit Increase Request" required /></div>
          <div className="form-group"><label>Message</label><textarea name="message" rows={5} required placeholder="Describe why you need more polls..." /></div>
          <button type="submit" className="btn-primary" disabled={status === "loading"}>{status === "loading" ? "Sending..." : "Send Message"}</button>
        </form>
        <div className="contact-alt"><p>Or reach out directly:</p><a href="mailto:pandeyviren68@gmail.com">pandeyviren68@gmail.com</a></div>
      </div>
    </DashboardLayout>
  );
}
