# database.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

# 1. Setup SQLite Database
DATABASE_URL = "sqlite:///./orders.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. Define the Order Table
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    item = Column(String, index=True)
    quantity = Column(Integer)
    price = Column(Float)
    status = Column(String, default="pending")  # pending, ready
    created_at = Column(DateTime, default=datetime.now)

# 3. Create Tables
def init_db():
    Base.metadata.create_all(bind=engine)

# Helper for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()