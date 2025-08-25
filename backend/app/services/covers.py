from __future__ import annotations
from typing import Optional

from ..db.repository import Repository
from ..models.schemas import Work
from .openai_gateway import OpenAIGateway


class CoverPipeline:
    def __init__(self, repo: Repository, oa: OpenAIGateway):
        self.repo = repo
        self.oa = oa

    async def generate_and_store_cover(
        self,
        *,
        work: Work,
        size: str = "1024x1024",
    ) -> Optional[Work]:
        img = self.oa.generate_cover_image_bytes(
            title=work.title,
            author=work.author,
            short_summary=work.short_summary,
            full_summary=work.full_summary,
            size=size,
        )
        updated = await self.repo.set_work_cover(work.id, img, content_type="image/png")
        return updated
