from dataclasses import dataclass


@dataclass
class Office:
    name: str
    purpose: str
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    source_url: str | None = None


OFFICES = [
    Office("Academic Affairs", "Classes, grades, registration, graduation", source_url="https://example.com/academics"),
    Office("Student Services", "General inquiries and support", source_url="https://example.com/services"),
    Office("Student Life", "Clubs, wellness, campus activities"),
    Office("Technical Support", "Accounts, systems, technical issues"),
    Office("Admissions", "Admissions, applications, enrollment", source_url="https://example.com/admissions"),
    Office("Housing and Accommodations", "Housing, residence, facilities", source_url="https://example.com/housing"),
]


def route_office(question: str) -> Office:
    lowered = question.lower()
    if any(term in lowered for term in ["visa", "arc", "immigration", "arrival", "airport"]):
        return OFFICES[1]
    if any(term in lowered for term in ["grade", "class", "attendance", "course", "graduation", "calendar"]):
        return OFFICES[0]
    if any(term in lowered for term in ["id card", "student id", "club", "welfare"]):
        return OFFICES[2]
    if any(term in lowered for term in ["lms", "smart campus", "login", "password"]):
        return OFFICES[3]
    if any(term in lowered for term in ["dorm", "housing", "room"]):
        return OFFICES[5]
    if any(term in lowered for term in ["admission", "apply", "application"]):
        return OFFICES[4]
    return OFFICES[1]
