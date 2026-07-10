"""Subject routes (user-owned subject management)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.schemas import SubjectCreate, SubjectOut, SubjectUpdate
from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")
router = APIRouter(tags=["subjects"])


@router.get("/subjects", response_model=list[SubjectOut])
async def list_user_subjects(
    current_user: str = Depends(get_current_user),
) -> list[SubjectOut]:
    """Return the authenticated user's subjects (creates defaults on first call)."""
    subjects = await mongodb_service.get_or_create_default_subjects(current_user)
    return [SubjectOut(**s) for s in subjects]


@router.post("/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(
    data: SubjectCreate,
    current_user: str = Depends(get_current_user),
) -> SubjectOut:
    """Create a new subject for the authenticated user."""
    existing = await mongodb_service.get_user_subject_by_name(current_user, data.name)
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Une matière nommée '{data.name}' existe déjà.",
        )
    subject_id = await mongodb_service.create_subject(current_user, data.model_dump())
    subject = await mongodb_service.get_subject(subject_id)
    return SubjectOut(**subject)


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: str,
    data: SubjectUpdate,
    current_user: str = Depends(get_current_user),
) -> SubjectOut:
    """Update a subject's name, color, or icon."""
    subject = await mongodb_service.get_subject(subject_id)
    if not subject or subject["user_id"] != current_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Matière non trouvée.")

    update_fields = data.model_dump(exclude_none=True)
    if not update_fields:
        return SubjectOut(**subject)

    if "name" in update_fields and update_fields["name"].lower() != subject["name"].lower():
        existing = await mongodb_service.get_user_subject_by_name(current_user, update_fields["name"])
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Une matière nommée '{update_fields['name']}' existe déjà.",
            )

    await mongodb_service.update_subject(subject_id, update_fields)
    updated = await mongodb_service.get_subject(subject_id)
    return SubjectOut(**updated)


@router.delete("/subjects/{subject_id}")
async def delete_subject(
    subject_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Delete a subject; notes using it are moved to 'À classer'."""
    subject = await mongodb_service.get_subject(subject_id)
    if not subject or subject["user_id"] != current_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Matière non trouvée.")

    if subject["name"].lower() == "à classer":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La matière 'À classer' ne peut pas être supprimée.",
        )

    # Ensure "À classer" exists as the transfer target
    unclass = await mongodb_service.get_user_subject_by_name(current_user, "À classer")
    if not unclass:
        unclass_id = await mongodb_service.create_subject(
            current_user, {"name": "À classer", "color": "#F59E0B", "icon": "inbox-outline"}
        )
        unclass = await mongodb_service.get_subject(unclass_id)

    transferred = await mongodb_service.transfer_notes_subject(
        from_subject_id=subject_id,
        to_subject_id=unclass["id"],
        to_subject_name=unclass["name"],
        user_id=current_user,
    )
    await mongodb_service.delete_subject(subject_id)

    return {"deleted": True, "notes_transferred": transferred}
