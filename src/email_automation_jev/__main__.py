"""Allow installed packages to run as ``python -m email_automation_jev``."""

from .commands.dispatch import main

if __name__ == "__main__":
    main()
