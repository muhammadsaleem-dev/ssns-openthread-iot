from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    backend_url: str = "http://backend:8080"
    poll_interval_seconds: int = 15
    baseline_window_size: int = 40  # Number of initial readings (10 minutes at 15s poll) to buffer before auto-fitting ML model
    
    # Model configuration for environment variables (e.g. from docker-compose)
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
