import os

from sqlmodel import SQLModel, create_engine


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./app.db")


def create_db_engine():
    url = get_database_url()

    connect_args = None
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    return create_engine(url, echo=False, connect_args=connect_args)


engine = create_db_engine()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
