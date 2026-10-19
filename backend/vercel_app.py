"""Expose the API when Vercel uses backend/ as the service root."""

import importlib.util
from pathlib import Path
import sys

# Service bundles may not retain the repository's enclosing backend/ directory.
# Load the package explicitly so existing backend.* imports work in either layout.
if "backend" not in sys.modules:
    package_root = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(
        "backend",
        package_root / "__init__.py",
        submodule_search_locations=[str(package_root)],
    )
    if spec is None or spec.loader is None:
        raise ImportError("Cannot load the backend package")
    package = importlib.util.module_from_spec(spec)
    sys.modules["backend"] = package
    spec.loader.exec_module(package)

from backend.main import app  # noqa: E402,F401
