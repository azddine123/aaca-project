"""Logging configuration with colored output."""

import json
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from colorama import Fore, Style, init

from app.core.config import settings

# Initialize colorama
init(autoreset=True)


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color support for terminal output."""

    COLORS = {
        "DEBUG": Fore.CYAN,
        "INFO": Fore.GREEN,
        "WARNING": Fore.YELLOW,
        "ERROR": Fore.RED,
        "CRITICAL": Fore.MAGENTA,
    }

    def format(self, record: logging.LogRecord) -> str:
        """Format log record with colors."""
        color = self.COLORS.get(record.levelname, "")
        record.levelname = f"{color}{record.levelname}{Style.RESET_ALL}"
        return super().format(record)


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        return json.dumps(log_data)


def setup_logging() -> logging.Logger:
    """Setup application logging."""
    logger = logging.getLogger("aaca")
    level_val = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(level_val)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level_val)

        if settings.LOG_FORMAT == "json":
            formatter = JSONFormatter(datefmt="%Y-%m-%d %H:%M:%S")
            log_dir = Path("logs")
            log_dir.mkdir(exist_ok=True)
            file_handler = RotatingFileHandler(
                log_dir / "aaca.log", maxBytes=10*1024*1024, backupCount=5
            )
            file_handler.setLevel(level_val)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        else:
            formatter = ColoredFormatter(
                "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
