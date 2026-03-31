import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import gradio as gr
import requests
import json

API_BASE = os.getenv("API_BASE", "http://localhost:8000")

def fetch_simulate():
    try:
        resp = requests.get(f"{API_BASE}/simulate", timeout=60)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e), "mode": "unavailable"}

def fetch_satellites():
    try:
        resp = requests.get(f"{API_BASE}/satellites", timeout=60)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

def fetch_odri(sat_id: str = ""):
    try:
        url = f"{API_BASE}/risk/odri"
        if sat_id:
            url += f"?sat_id={sat_id}"
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

def cascade_ask(question: str):
    try:
        resp = requests.post(
            f"{API_BASE}/cascade/ask",
            json={"question": question},
            timeout=60
        )
        resp.raise_for_status()
        return resp.json().get("answer", "No answer returned")
    except Exception as e:
        return f"Error: {str(e)}"

def fetch_health():
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

with gr.Blocks(title="SpaceDebrisAI", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        """
        # 🛰️ SpaceDebrisAI
        **Real-time Satellite Conjunction Monitoring & Cascade Intelligence**
        
        This Space exposes the orbital collision risk pipeline — live TLE propagation via SGP4, 
        conjunction screening, ODRI scoring, and AI-powered cascade analysis.
        """
    )
    
    with gr.Tabs():
        with gr.TabItem("🚀 API Status"):
            gr.Markdown("### API Health Check")
            health_btn = gr.Button("Check API Health")
            health_output = gr.JSON(label="Health Response")
            health_btn.click(fn=fetch_health, outputs=health_output)
        
        with gr.TabItem("🔬 Conjunction Simulation"):
            gr.Markdown("### Run Full Conjunction Pipeline")
            gr.Markdown(
                "Fetches live TLE data from CelesTrak, propagates positions via SGP4, "
                "screens all satellite pairs, classifies collision risk, and recommends maneuvers."
            )
            simulate_btn = gr.Button("Run Simulation", variant="primary")
            simulate_output = gr.JSON(label="Simulation Results")
            simulate_btn.click(fn=fetch_simulate, outputs=simulate_output)
        
        with gr.TabItem("🛰️ Satellite Registry"):
            gr.Markdown("### Tracked Satellite Positions")
            sat_btn = gr.Button("Fetch Satellites")
            sat_output = gr.JSON(label="Satellite Data")
            sat_btn.click(fn=fetch_satellites, outputs=sat_output)
        
        with gr.TabItem("📊 ODRI Score"):
            gr.Markdown("### Orbital Debris Risk Index")
            gr.Markdown(
                "ODRI = σ_collision × ω_cascade × ψ_temporal × φ_maneuver\n\n"
                "Shell-level and object-level risk scoring based on collision susceptibility, "
                "cascade amplification, temporal urgency, and maneuver resilience."
            )
            sat_id_input = gr.Textbox(label="Satellite ID (optional)", placeholder="e.g., ISS")
            odri_btn = gr.Button("Get ODRI Score")
            odri_output = gr.JSON(label="ODRI Response")
            odri_btn.click(fn=lambda sid: fetch_odri(sid), inputs=sat_id_input, outputs=odri_output)
        
        with gr.TabItem("🧠 Cascade Intelligence"):
            gr.Markdown("### AI-Powered Cascade Analysis")
            gr.Markdown(
                "Ask natural-language questions grounded in live ODRI data, shell density, "
                "and conjunction warnings. Powered by Groq LLM with deterministic fallback."
            )
            cascade_input = gr.Textbox(
                label="Your Question",
                placeholder="What is the current Kessler cascade risk in LEO?",
                lines=3
            )
            cascade_btn = gr.Button("Ask AI", variant="primary")
            cascade_output = gr.Textbox(label="AI Response", lines=5)
            cascade_btn.click(fn=cascade_ask, inputs=cascade_input, outputs=cascade_output)

    gr.Markdown(
        """
        ---
        
        **Architecture:** FastAPI + SGP4 + Gradio Interface
        
        [GitHub Repository](https://github.com/viren-pandey/SpaceDebrisAI) · 
        [Live Demo](https://spacedebrisai.vercel.app)
        """
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
