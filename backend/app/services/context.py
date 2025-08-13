from typing import List
from ..db.repository import Repository
from ..models.schemas import RequestResponsePair


class ContextService:
    def __init__(self, repo: Repository):
        self.repo = repo

    async def get_compact_conversation_context(
        self,
        conversation_id: int,
        max_messages: int = 20,
        prefer_summaries: bool = True,
    ) -> List[dict]:
        """
        Return a compact list of dicts shaped for LLM input.
        - Uses summary when available and `prefer_summaries` is True.
        - Includes role derivation.
        """
        page = await self.repo.list_messages(
            conversation_id, offset=0, limit=max_messages
        )
        prompt_msgs = []
        for m in page.items:
            content = (m.summary if prefer_summaries and m.summary else m.text) or ""
            prompt_msgs.append({"role": m.role, "content": content})
        return prompt_msgs

    async def get_last_n_pairs(
        self, conversation_id: int, n: int
    ) -> List[RequestResponsePair]:
        return await self.repo.list_last_n_request_response_pairs(conversation_id, n)
