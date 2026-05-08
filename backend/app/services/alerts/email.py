from dataclasses import dataclass


@dataclass(frozen=True)
class EmailMessage:
    subject: str
    body: str
    to_email: str


class EmailAlertSender:
    def __init__(self, enabled: bool) -> None:
        self._enabled = enabled

    async def send(self, message: EmailMessage) -> bool:
        if not self._enabled:
            return False
        # SMTP delivery is implemented in the alert integration task.
        return bool(message.to_email and message.subject)
