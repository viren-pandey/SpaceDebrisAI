import { useState } from "react";

const ACCESS_KEY = "5671fd75-8422-4d8e-859b-ec0e67f6d6db";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const formData = new FormData();
      formData.append("access_key", ACCESS_KEY);
      formData.append("name", name);
      formData.append("email", email);
      formData.append("subject", subject || "SpaceDebrisAI Contact");
      formData.append("message", message);

      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <div className="sph-hero">
        <div className="sph-ring sph-ring-1" />
        <div className="sph-ring sph-ring-2" />
        <div className="sph-ring sph-ring-3" />
        <div className="sph-globe" />

        <p className="sph-pre">GET IN TOUCH</p>
        <h1 className="sph-big-num">Contact</h1>
        <h2 className="sph-label">US</h2>
        <p className="sph-tagline">
          Have questions about space debris, want to collaborate, or just say hi?
        </p>
      </div>

      <div className="contact-section">
        {status === "success" ? (
          <div className="contact-success">
            <div className="contact-success-icon">✓</div>
            <h2 className="contact-success-title">Message Sent!</h2>
            <p className="contact-success-text">
              Thanks for reaching out. We'll get back to you soon.
            </p>
          </div>
        ) : (
          <div className="contact-card">
            {status === "error" && (
              <div className="contact-error">
                Something went wrong — please try again.
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="contact-row">
                <div className="contact-field">
                  <label className="contact-label">Name</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="contact-input"
                  />
                </div>
                <div className="contact-field">
                  <label className="contact-label">Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="contact-input"
                  />
                </div>
              </div>

              <div className="contact-field">
                <label className="contact-label">
                  Subject <span className="contact-label-opt">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What's this about?"
                  className="contact-input"
                />
              </div>

              <div className="contact-field">
                <label className="contact-label">Message</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  className="contact-input contact-textarea"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="contact-submit"
              >
                {status === "loading" ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
