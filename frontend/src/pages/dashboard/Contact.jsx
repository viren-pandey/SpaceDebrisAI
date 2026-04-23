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
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome"><h1>Message Sent</h1></div>
        <div className="dash-no-key" style={{ borderColor: "rgba(34,197,94,.3)", background: "rgba(34,197,94,.04)" }}>
          <h3>Thank you!</h3>
          <p>We&apos;ll review your request within 24–48 hours.</p>
          <button onClick={() => navigate("/dashboard")} className="btn-primary">Back to Dashboard</button>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="dash-page">
        <div className="dash-welcome">
          <h1>Contact</h1>
        </div>
        <p className="dash-page-sub" style={{ color: "var(--text-dim)", fontSize: 14, margin: "-12px 0 20px" }}>Request a poll limit increase or reach out about your account.</p>
        {status === "error" && <div className="dash-limit-warning"><p>Failed to send message. Please try again.</p></div>}
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group"><label>Name</label><input type="text" defaultValue={user?.email?.split("@")[0]} required /></div>
          <div className="form-group"><label>Email</label><input type="email" defaultValue={user?.email} required /></div>
          <div className="form-group"><label>Subject</label><input type="text" defaultValue="Poll Limit Increase Request" required /></div>
          <div className="form-group"><label>Message</label><textarea name="message" rows={5} required placeholder="Describe why you need more polls..." /></div>
          <button type="submit" className="btn-primary" disabled={status === "loading"} style={{ alignSelf: "flex-start" }}>{status === "loading" ? "Sending..." : "Send Message"}</button>
        </form>
        <div className="contact-alt"><p>Or reach out directly:</p><a href="mailto:pandeyviren68@gmail.com">pandeyviren68@gmail.com</a></div>
      </div>
    </DashboardLayout>
  );
}
