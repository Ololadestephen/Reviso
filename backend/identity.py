"""Internal users are distinct from login methods.

Ownership is always an internal user id. A later Google or other login is an
identity row pointing at that user. Email is display data, never a merge key.
"""

from dataclasses import dataclass
from typing import Literal

OPERATOR_USER_ID = "operator"
LOCAL_USER_ID = "local"

ISSUER_GOOGLE = "google"
ISSUER_LOCAL = "local"
ISSUER_SIMULATED = "simulated"

UserKind = Literal["person", "operator", "local"]
AuthMode = Literal["local", "google", "simulated"]


@dataclass(frozen=True)
class Principal:
    user_id: str
    kind: UserKind
    auth: AuthMode
    email: str | None
    display_name: str
    csrf_secret: str | None = None

    def public(self) -> dict[str, str | None]:
        return {
            "user_id": self.user_id,
            "kind": self.kind,
            "auth": self.auth,
            "email": self.email,
            "display_name": self.display_name,
        }


@dataclass(frozen=True)
class GoogleClaims:
    subject: str
    email: str | None = None
    name: str | None = None
