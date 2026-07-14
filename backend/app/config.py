from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./cannabis_tracker.db"
    SECRET_KEY: str = "CHANGE_ME_TO_A_SECURE_RANDOM_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    IMAGE_STORAGE_BACKEND: str = "local"
    IMAGE_STORAGE_PATH: str = "uploads"
    S3_BUCKET_NAME: str | None = None
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
