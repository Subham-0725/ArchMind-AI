# backend/app.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import os

# Load model
model_path = "model/panchakarma_dosha_model.pkl"
model = joblib.load(model_path)

# Recommendations dictionary
recommendations = {
    "vata": {
        "therapy": "basti",
        "herbs": ["ashwagandha", "triphala"],
        "lifestyle": ["oil massage", "warm food", "rest"]
    },
    "pitta": {
        "therapy": "virechana",
        "herbs": ["turmeric", "pippali"],
        "lifestyle": ["cooling diet", "hydration", "avoid spicy food"]
    },
    "kapha": {
        "therapy": "nasya",
        "herbs": ["ginger", "trikatu"],
        "lifestyle": ["exercise", "steam inhalation", "light diet"]
    },
    "vata-pitta": {
        "therapy": "shirodhara",
        "herbs": ["brahmi"],
        "lifestyle": ["yoga", "meditation", "good sleep"]
    }
}

# FastAPI app
app = FastAPI()

# Request body schema
class SymptomInput(BaseModel):
    symptoms: str

@app.get("/")
def root():
    return {"message": "Panchakarma ML API running 🚀"}

@app.post("/predict")
def predict_dosha(input_data: SymptomInput):
    predicted_dosha = model.predict([input_data.symptoms])[0]
    rec = recommendations[predicted_dosha]
    return {
        "input": input_data.symptoms,
        "predicted_dosha": predicted_dosha,
        "recommendations": rec
    }