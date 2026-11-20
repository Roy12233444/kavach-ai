"""
UIR-001: Viveka Intent Discrimination Engine
============================================
Authoritative cognitive layer for discriminating user intent into:
    - CHAT
    - TASK
    - HYBRID_INTERACTIVE

Principles:
1. Viveka classifies only. It does not answer, plan, execute, or fabricate targets.
2. Two-tier architecture: Deterministic Fast Path (<1ms) -> 10-Block LLM Fallback.
3. Context-aware: Resolves missing targets via conversation history.
4. Asymmetric cost model: Uncertain classifications bias toward CHAT or HYBRID_INTERACTIVE,
   NEVER toward accidental TASK execution.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

logger = logging.getLogger(__name__)


# ============================================================================
# 1. Canonical Intent Types and Results
# ============================================================================

class IntentType(str, Enum):
    CHAT = "chat"
    TASK = "task"
    HYBRID_INTERACTIVE = "hybrid_interactive"


# Backwards compatibility alias
Intent = IntentType


@dataclass
class Turn:
    """A single turn in conversation history."""
    role: str  # "user" | "assistant"
    content: str
    intent: Optional[IntentType] = None


@dataclass(frozen=True)
class IntentResult:
    """Canonical classification artifact produced by Viveka."""
    intent: IntentType
    confidence: float
    path: Literal["fast", "llm"]
    decision_basis: str
    raw: Optional[IntentType] = None
    tier: int = 1
    reason: str = ""
    fallback_used: bool = False

    def __post_init__(self):
        # Guarantee raw and reason are populated for backwards compatibility
        if self.raw is None:
            object.__setattr__(self, "raw", self.intent)
        if not self.reason:
            object.__setattr__(self, "reason", self.decision_basis)


# ============================================================================
# 2. Fast-Path Regex & Knowledge Patterns
# ============================================================================

_GREETING_PATTERN = re.compile(
    r"^\s*("
    r"hi|hello|hey|yo|sup|greetings|howdy|"
    r"hello,?\s+how\s+are\s+you|hi,?\s+how\s+are\s+you|"
    r"good\s+(morning|afternoon|evening|night)|"
    r"how\s+are\s+you|how'?s\s+it\s+going|what'?s\s+up|how\s+do\s+you\s+do|"
    r"thank\s+you|thanks|thx|appreciate\s+it|"
    r"bye|goodbye|see\s+you|later|peace|"
    r"namaste|hola|bonjour|"
    r"ok|okay|k|cool|nice|great|awesome|"
    r"are\s+you\s+(there|ok|ready)|"
    r"help(\s+me)?\??"
    r")\s*[.!?]?\s*$",
    re.IGNORECASE,
)

_META_PATTERN = re.compile(
    r"^\s*(?:"
    r"who\s+are\s+you|what\s+are\s+you|what'?s\s+your\s+name|who\s+made\s+you|who\s+created\s+you|"
    r"which\s+model(?:\s+are\s+you(?:\s+using)?)?|what\s+model(?:\s+are\s+you(?:\s+using)?)?|"
    r"are\s+you\s+(?:chatgpt|gpt|claude|gemini)|"
    r"what\s+can\s+you\s+do|"
    r"(?:what|tell\s+me\s+)?(?:are|is)\s+(?:your|the\s+agent'?s?)\s+"
    r"(?:capabilities|skills|tools|features|abilities|limitations|strengths)|"
    r"tell\s+me\s+(?:(?:what\s+)?(?:is|are)\s+)?(?:your|the\s+agent'?s?)\s+"
    r"(?:capabilities|skills|tools|features|abilities|limitations)|"
    r"what\s+(?:are|is)\s+(?:your|the\s+agent'?s?)\s+"
    r"(?:capabilities|skills|tools|features|abilities|limitations)|"
    r"(?:what|which)\s+tools\s+do\s+you\s+(?:have|support|use)|"
    r"how\s+do\s+you\s+reason|how\s+do\s+you\s+think|"
    r"how\s+do\s+you\s+(?:work|decide|choose)|"
    r"why\s+did\s+you\s+(?:open|close|trigger|start|enter|show|ask|use|choose|decide|do|run|test)\b.*|"
    r"why\s+(?:did|do)\s+you\s+open\s+(?:the\s+)?human\s+in\s+the\s+loop|"
    r"what\s+did\s+you\s+do(?:\s+and\s+why)?|"
    r"why\s+did\s+you\s+(?:respond|route|classify|act|behave)\b.*"
    r")\s*[.!?]?\s*$",
    re.IGNORECASE,
)

_EXPLANATION_REQUEST_PATTERN = re.compile(
    r"^\s*(?:"
    r"tell\s+me\s+how\s+to\b|"
    r"tell\s+me\s+(?:about|what|why|how|whether)\b|"
    r"can\s+you\s+(?:please\s+)?(?:explain|describe|clarify|walk\s+me\s+through)\b|"
    r"could\s+you\s+(?:please\s+)?(?:explain|describe|clarify|walk\s+me\s+through)\b|"
    r"please\s+(?:explain|describe|clarify)\b|"
    r"what\s+should\s+i\s+(?:change|do|modify)\s+in\b|"
    r"how\s+do\s+i\s+(?:fix|use|implement|write|run|test)\b|"
    r"how\s+does\s+.*\s+work\b|"
    r"what\s+is\s+the\s+difference\s+between\b|"
    r"(?:explain|describe|clarify)\s+(?:your|the\s+agent'?s?)\s+"
    r"(?:capabilities|skills|tools|features|reasoning|behavior|decision|response)\b"
    r")",
    re.IGNORECASE,
)

_CONCEPTUAL_QUESTION_PATTERN = re.compile(
    r"^\s*(?:"
    r"what\s+(?:is|are|was|were|does|do)\b|"
    r"who\s+(?:is|are|was|were)\b|"
    r"why\s+(?:is|are|was|were|does|do|did)\b|"
    r"when\s+(?:is|are|was|were|does|do|did)\b|"
    r"where\s+(?:is|are|was|were|does|do|did)\b|"
    r"how\s+(?:does|do|did|is|are|was|were)\b|"
    r"can\s+you\s+(?:explain|describe|clarify|tell\s+me)\b|"
    r"could\s+you\s+(?:explain|describe|clarify|tell\s+me)\b|"
    r"would\s+you\s+(?:explain|describe|clarify)\b|"
    r"is\s+(?:there|this|that)\b|are\s+(?:there|these|those)\b"
    r")",
    re.IGNORECASE,
)

_QUESTION_FRAMING_PATTERN = re.compile(
    r"^\s*(?:"
    r"what|who|why|when|where|how|which|whose|whether|"
    r"can|could|would|should|is|are|was|were|do|does|did"
    r")\b",
    re.IGNORECASE,
)

_EXPLICIT_ACTION_REQUEST_PATTERN = re.compile(
    r"^\s*(?:please\s+)?(?:"
    r"(?:can|could|will)\s+you\s+)?"
    r"(?:please\s+)?(?:"
    r"write|create|build|generate|execute|run|fix|refactor|audit|"
    r"benchmark|delete|install|deploy|debug|test|compile|implement|"
    r"modify|update|remove|clean|lint|optimize"
    r")\b",
    re.IGNORECASE,
)

_ACTION_VERB_PATTERN = re.compile(
    r"\b("
    r"write|create|build|generate|execute|run|fix|refactor|audit|"
    r"benchmark|delete|install|deploy|debug|test|compile|implement|"
    r"modify|update|remove|clean|lint|optimize|open|close|start|stop|"
    r"change|save|move|rename|patch|migrate|restart|launch|trigger|loop"
    r")\b",
    re.IGNORECASE,
)

# Semantic speech-act markers. These are intentionally small and composable;
# they describe grammatical/request roles rather than treating action vocabulary
# as authority.
_EXECUTION_QUESTION_PATTERN = re.compile(
    r"^\s*(?:please\s+)?(?:can|could|would|will)\s+you\s+",
    re.IGNORECASE,
)
_ADVICE_QUESTION_PATTERN = re.compile(
    r"^\s*(?:should|might|may)\s+(?:i|we|you)\b|"
    r"^\s*(?:what|which|how)\s+.*\bshould\s+(?:i|we)\b|"
    r"^\s*would\s+it\s+be\s+(?:better|safe|wise)\b",
    re.IGNORECASE,
)
_NEGATED_OPERATION_PATTERN = re.compile(
    r"\b(?:do\s+not|don't|does\s+not|doesn't|did\s+not|didn't|"
    r"cannot|can't|shouldn't|wouldn't|couldn't|will\s+not|won't|"
    r"never|no\s+need\s+to|without)\b[^.!?]{0,80}\b("
    r"run|test|execute|deploy|delete|remove|modify|change|fix|open|close|"
    r"start|stop|create|build|write|update|refactor|restart|trigger|loop"
    r")\b",
    re.IGNORECASE,
)
_QUOTED_OPERATION_PATTERN = re.compile(
    r"(?:['\"])(?:[^'\"]{0,120})(?:['\"])",
    re.IGNORECASE,
)

_EXPLICIT_FILE_OR_PATH_PATTERN = re.compile(
    r"("
    r"[A-Za-z0-9_\-\.]+\.(py|js|ts|tsx|jsx|html|css|json|yaml|yml|txt|md|log|rs|go|java|c|cpp|h)\b|"
    r"[A-Za-z]:\\|"  # Windows absolute path
    r"/(?:home|Users|var|tmp|opt|etc|bin|usr)/|"  # Unix path
    r"\bdemo_files[\\/][A-Za-z0-9_\-\.]+\b|"
    r"\b(module|class|function|endpoint|test\s+suite|tests?|dockerfile)\b"
    r")",
    re.IGNORECASE,
)

_VAGUE_PRONOUN_OR_TARGET_PATTERN = re.compile(
    r"^\s*(?:please\s+|could\s+you\s+(?:maybe\s+)?)?(?:now\s+)?("
    r"fix\s+the\s+bug|"
    r"fix\s+it|"
    r"optimize\s+this|"
    r"make\s+it\s+faster|"
    r"deploy\s+it|"
    r"run\s+it|"
    r"debug\s+it|"
    r"refactor\s+it|"
    r"check\s+this|"
    r"clean\s+it|"
    r"test\s+it|"
    r"delete\s+it"
    r")\s*[.!]?\s*$",
    re.IGNORECASE,
)

CANNED_CHAT: dict[str, str] = {
    "hi": "Hello! How can I help you today?",
    "hello": "Hello! How can I help you today?",
    "hey": "Hey! What would you like to work on?",
    "thanks": "You're welcome!",
    "thank you": "You're welcome!",
    "bye": "Goodbye! Come back anytime.",
    "goodbye": "Goodbye! Come back anytime.",
    "who are you": "I am NALA (Nexus Autonomous Long-Running Agent), an advanced AI coding assistant built by Nexus LAB AI, founded by Sourav Ray. How can I help you today?",
    "what are you": "I am NALA (Nexus Autonomous Long-Running Agent), an advanced AI coding assistant built by Nexus LAB AI. I can help with code, autonomous task execution, and more!",
    "who made you": "I was built by Nexus LAB AI, founded by Sourav Ray.",
    "who created you": "I was created by Nexus LAB AI, founded by Sourav Ray.",
    "are you chatgpt": "No, I am NALA (Nexus Autonomous Long-Running Agent) by Nexus LAB AI, not ChatGPT.",
    "are you gpt": "No, I am NALA by Nexus LAB AI.",
    "what is your name": "My name is NALA — Nexus Autonomous Long-Running Agent, built by Nexus LAB AI.",
    "what's your name": "My name is NALA — Nexus Autonomous Long-Running Agent, built by Nexus LAB AI.",
}


def canned_chat_reply(prompt: str) -> Optional[str]:
    """Instant lookup for common greetings/identity queries."""
    key = re.sub(r"[.!?]+$", "", prompt.strip().lower())
    return CANNED_CHAT.get(key)


# ============================================================================
# 3. Context Target Resolution from History
# ============================================================================

def _extract_target_from_history(history: Optional[List[Union[Turn, dict]]]) -> Optional[str]:
    """Scan recent conversation history (last 5 turns) for an identifiable file or entity."""
    if not history:
        return None

    # Work backwards through recent turns
    for turn in reversed(history[-5:]):
        text = turn.content if isinstance(turn, Turn) else turn.get("content", "")
        if not text:
            continue
        match = _EXPLICIT_FILE_OR_PATH_PATTERN.search(text)
        if match:
            return match.group(0)
        # Check for named bug or component pattern
        bug_match = re.search(r"\b([a-zA-Z0-9_\-]+\.(?:py|ts|tsx|js|json))\b", text)
        if bug_match:
            return bug_match.group(1)
        if "authentication bug" in text.lower():
            return "authentication bug"
        if "sessionemitter" in text.lower():
            return "SessionEmitter"

    return None


# ============================================================================
# 4. Deterministic Fast-Path Classifier
# ============================================================================

def _result(intent: IntentType, confidence: float, basis: str) -> IntentResult:
    """Construct a Tier-0 result while keeping the public result contract stable."""
    return IntentResult(
        intent=intent,
        confidence=confidence,
        path="fast",
        decision_basis=basis,
        tier=0,
    )


def _starts_with_action_directive(text: str) -> bool:
    """Return True only for directive-like openings, not merely action vocabulary."""
    return bool(re.match(
        r"^\s*(?:please\s+)?(?:now\s+)?(?:"
        r"write|create|build|generate|execute|run|fix|refactor|audit|benchmark|"
        r"delete|install|deploy|debug|test|compile|implement|modify|update|remove|"
        r"clean|lint|optimize|open|close|start|stop|change|save|move|rename|patch|"
        r"migrate|restart|launch|trigger|loop)\b",
        text,
        re.IGNORECASE,
    ))


def _has_explicit_target(text: str) -> bool:
    """Identify a concrete execution target without claiming authorization."""
    if _EXPLICIT_FILE_OR_PATH_PATTERN.search(text):
        return True
    return bool(re.search(
        r"\b(?:this|that|the|a|an|my|your)\s+"
        r"(?:file|folder|directory|module|class|function|script|service|endpoint|"
        r"command|migration|branch|database|container|test|tests|test\s+suite|"
        r"application|app|project|repo|repository|workflow|job|process|server)\b",
        text,
        re.IGNORECASE,
    )) or bool(re.search(
        r"\b(?:auth|authentication|api|backend|frontend|database|migration|"
        r"production|staging|hitl|approval|human\s+in\s+the\s+loop|session|agent|workbench|unit\s+tests?|integration\s+tests?|test\s+suite)\b",
        text,
        re.IGNORECASE,
    ))


def _has_executable_target_language(text: str) -> bool:
    """Broader target detection for creation requests such as 'write a Python function'."""
    return bool(re.search(
        r"\b(?:script|function|code|test(?:s|\s+suite)?|benchmark|program|"
        r"component|endpoint|service|workflow|pipeline|fibonacci|sort(?:s|ing)?\s+a\s+list)\b",
        text,
        re.IGNORECASE,
    )) or _has_explicit_target(text)


def _is_negated_or_prohibited(text: str) -> bool:
    """Detect explicit prohibition so negative commands cannot become TASK."""
    return bool(_NEGATED_OPERATION_PATTERN.search(text))


def _is_quoted_command_discussion(text: str) -> bool:
    """Detect messages where an operation is mentioned as quoted language."""
    if not _QUOTED_OPERATION_PATTERN.search(text):
        return False
    lowered = text.lower()
    return bool(re.search(
        r"\b(?:what does|what is|why does|why is|documentation|document|says|means|"
        r"mean|meaning|explain|describ|refer|mention|quote|instruction says)\b",
        lowered,
    ))


def _is_execution_question(text: str) -> bool:
    """Recognize question-shaped requests whose requested outcome is execution."""
    if not _EXECUTION_QUESTION_PATTERN.match(text):
        return False
    if _is_negated_or_prohibited(text):
        return False
    # Capability questions about explaining/teaching remain CHAT.
    if re.match(r"^\s*(?:please\s+)?(?:can|could|would|will)\s+you\s+"
                r"(?:please\s+)?(?:explain|describe|clarify|tell\s+me|show\s+me|"
                r"walk\s+me\s+through)\b", text, re.IGNORECASE):
        # A compound form can still contain an actual execution request:
        # "Can you explain the failure and fix it?"
        return _has_compound_execution_directive(text)
    return bool(_ACTION_VERB_PATTERN.search(text))


def _is_advice_or_discussion_question(text: str) -> bool:
    """Return True for advice/discussion speech acts, even when action words occur."""
    return bool(_ADVICE_QUESTION_PATTERN.search(text))


def _has_compound_execution_directive(text: str) -> bool:
    """Detect an execution component following explanatory/discourse language."""
    return bool(re.search(
        r"\b(?:and\s+then|then|and)\s+(?:please\s+)?(?:"
        r"run|execute|fix|refactor|deploy|delete|remove|modify|change|create|build|"
        r"write|update|test|open|close|start|stop|restart|migrate|patch|rename|move)\b",
        text,
        re.IGNORECASE,
    ))


def _fast_path_classify(
    prompt: str,
    history: Optional[List[Union[Turn, dict]]] = None,
) -> Optional[IntentResult]:
    """Deterministic Tier-0 speech-act classifier.

    The ordering is a safety boundary, not a bag of keyword rules:
    conversation/meta -> explanation/discussion -> advice/negation/quoted language
    -> execution questions/directives -> target resolution -> Tier-1 fallback.
    """
    text = (prompt or "").strip()
    if not text:
        return _result(IntentType.CHAT, 1.0, "Empty or whitespace input.")

    if _GREETING_PATTERN.match(text):
        return _result(IntentType.CHAT, 0.98, "Conversational greeting without an actionable request.")

    if _META_PATTERN.match(text):
        return _result(IntentType.CHAT, 0.99, "Meta, capability, reasoning, or system-behavior discourse about NALA.")

    # Strong non-execution shields. These run before generic action detection.
    if _is_quoted_command_discussion(text):
        return _result(IntentType.CHAT, 0.99, "Operation is being mentioned or discussed as quoted language, not requested for execution.")

    if _is_negated_or_prohibited(text):
        return _result(IntentType.CHAT, 0.98, "Operation is explicitly negated or prohibited; no execution request is authorized by the message.")

    # Advice questions ask for a recommendation, not an operation performed by NALA.
    if _is_advice_or_discussion_question(text):
        return _result(IntentType.CHAT, 0.98, "Advice or discussion question; the user asks what should happen rather than asking NALA to perform it.")

    # A compound utterance can begin with explanation language while still ending
    # in an explicit operation request: "Explain auth.py and then fix it."
    if _has_compound_execution_directive(text) and not _QUESTION_FRAMING_PATTERN.match(text):
        has_target = _has_executable_target_language(text)
        if has_target:
            return _result(IntentType.TASK, 0.97, "Compound request contains an explicit execution component with a concrete target.")
        prior_target = _extract_target_from_history(history)
        if prior_target:
            return _result(IntentType.TASK, 0.93, f"Compound execution request resolved against target '{prior_target}' from conversation history.")
        return _result(IntentType.HYBRID_INTERACTIVE, 0.94, "Compound execution request detected, but the execution target is missing.")

    # Direct execution request expressed as a capability/permission question.
    # This must run before the generic explanation shield so that
    # "Can you explain the failure and fix it?" remains an execution request.
    if _is_execution_question(text):
        has_target = _has_executable_target_language(text)
        # Compound capability/execution questions such as
        # "Can you explain the failure and fix it?" contain an explicit action
        # component. Treat the referenced object as the requested target; the
        # downstream authorization layer still decides whether execution is allowed.
        compound_referent = bool(re.search(r"\b(?:and\s+then|and)\s+(?:fix|run|test|deploy|refactor|modify|update|delete|open|close)\s+it\b", text, re.I))
        if has_target or compound_referent:
            return _result(IntentType.TASK, 0.97, "Question-shaped request explicitly asks NALA to perform an operation on an identifiable or compound-referenced target.")
        prior_target = _extract_target_from_history(history)
        if prior_target:
            return _result(IntentType.TASK, 0.93, f"Execution request with target '{prior_target}' resolved from authoritative conversation history.")
        return _result(IntentType.HYBRID_INTERACTIVE, 0.94, "Execution request detected, but no sufficient target or scope is available.")

    # Explanation / conceptual discourse is immune to embedded action words.
    if _EXPLANATION_REQUEST_PATTERN.search(text) and not _starts_with_action_directive(text):
        return _result(IntentType.CHAT, 0.99, "Explanation or informational inquiry; operation vocabulary is discussed rather than requested for execution.")

    # Questions such as 'why did you run...', 'how does deployment work...', and
    # 'what happens if we run...' are informational even though they contain actions.
    if _QUESTION_FRAMING_PATTERN.match(text):
        return _result(IntentType.CHAT, 0.98, "Question/feedback speech act requests information or explanation; embedded action words are not execution authorization.")

    # Explicit execution directive.
    # Explicit directives are execution requests. Compound explanation + action
    # requests remain TASK because the action component is authoritative.
    if _starts_with_action_directive(text):
        has_target = _has_executable_target_language(text)
        if has_target:
            return _result(IntentType.TASK, 0.97, "Explicit execution directive with a concrete target or operation scope.")
        prior_target = _extract_target_from_history(history)
        if prior_target:
            return _result(IntentType.TASK, 0.93, f"Explicit execution directive with target '{prior_target}' resolved from conversation history.")
        return _result(IntentType.HYBRID_INTERACTIVE, 0.94, "Explicit execution directive detected, but the target or scope is missing.")

    # Action words in non-directive statements are not enough to escalate.
    if _ACTION_VERB_PATTERN.search(text):
        if _has_executable_target_language(text) and re.search(r"\b(?:create|write|build|generate|implement|modify|update|delete|remove|refactor|deploy|execute|run|test|fix|open|close|start|stop|change|save|move|rename|patch|migrate|restart|launch|trigger)\b", text, re.I):
            # Do not manufacture TASK from a sentence whose speech act is still unclear.
            return None
        return _result(IntentType.CHAT, 0.90, "Action vocabulary appears as topic/content without a decisive execution speech act.")

    # Research/recommendation requests remain conversational.
    if re.search(r"^\s*(?:research|search|recommend|suggest|what\s+are\s+the\s+best|find\s+the\s+best|tell\s+me\s+about|compare)\b", text, re.I):
        return _result(IntentType.CHAT, 0.98, "Research or recommendation request; no workspace execution directive is present.")

    return None


# ============================================================================
# 5. 10-Block Viveka System Prompt Construction
# ============================================================================

def build_viveka_prompt(
    user_message: str,
    history: Optional[List[Union[Turn, dict]]] = None,
    session_id: Optional[str] = None,
    pramana_state: Optional[str] = None,
    tool_list: Optional[str] = None,
    prior_intent: Optional[str] = None,
) -> str:
    """Build the exact 10-block Viveka XML classification prompt."""
    history_lines = []
    if history:
        for turn in history[-5:]:
            role = turn.role if isinstance(turn, Turn) else turn.get("role", "user")
            content = turn.content if isinstance(turn, Turn) else turn.get("content", "")
            history_lines.append(f"<{role}>{content}</{role}>")
    formatted_history = "\n".join(history_lines) if history_lines else "<none>No prior history</none>"

    return f"""<system_prompt>

<task_context>
You are Viveka — NALA's Intent Discrimination Layer.
Your sole function is to classify one incoming user message into exactly one of three intents:
    CHAT
    TASK
    HYBRID_INTERACTIVE
You do not answer the message.
You do not plan a solution.
You do not execute tools.
You classify, and nothing else.
</task_context>

<tone_context>
Be decisive. Do not invent missing information.
When genuinely torn between CHAT and TASK: prefer CHAT.
A wrongly opened execution experience is worse than a slightly generic conversational response.
When genuinely torn between TASK and HYBRID_INTERACTIVE: prefer HYBRID_INTERACTIVE.
Asking for clarification is cheaper than executing against the wrong target.
</tone_context>

<context_data>
Session ID: {session_id or 'none'}
Active Pramāṇa state: {pramana_state or 'pratyaksha_active'}
Available tools: {tool_list or 'filesystem_writer, code_executor, test_runner'}
Prior intent: {prior_intent or 'none'}
</context_data>

<rules>
1. First determine the speech act: discussion, explanation, advice, capability inquiry, execution question, or direct execution directive.
2. CHAT:
   - greetings and ordinary conversation
   - conceptual/informational questions
   - explanations and advice
   - capability/meta questions about NALA
   - retrospective/evaluative questions about prior behavior
   - operation words used as topics, examples, quoted text, or explanations
3. TASK:
   - the user actually asks NALA to perform an operation
   - the request may be a direct imperative OR a question such as 'Can/Could/Would/Will you run X?'
   - target/scope is sufficiently identifiable
4. HYBRID_INTERACTIVE:
   - genuine execution intent exists
   - target/scope is missing or critically ambiguous
5. Action-word rule:
   - run/test/open/loop/fix/etc. are features, never final decisions
   - action vocabulary inside 'why/how/what happened/what does ... mean' is not authorization
6. Advice rule:
   - 'Should I...', 'What should I...', 'Which ... should I...' and similar advice requests are CHAT
7. Negation rule:
   - explicit prohibitions such as 'don't run' or 'do not deploy' are not execution requests
8. Quoted-command rule:
   - commands mentioned as quoted/documented language are not commands to NALA
9. History rule:
   - history may resolve a missing target ONLY after execution intent is established
10. Never use tool availability, prior capability, or context alone as evidence of authorization.
</rules>

<examples>
<example>
<input>hi there</input>
<decision_basis>Greeting. No action verb, no target.</decision_basis>
<intent>CHAT</intent>
<confidence>0.98</confidence>
</example>
<example>
<input>tell me what is your capabilities</input>
<decision_basis>Capability question about the agent; no workspace operation requested.</decision_basis>
<intent>CHAT</intent>
<confidence>0.98</confidence>
</example>
<example>
<input>why did you open the human in the loop buddy?</input>
<decision_basis>Meta-discourse about prior system behavior; the word open does not authorize an operation.</decision_basis>
<intent>CHAT</intent>
<confidence>0.98</confidence>
</example>
<example>
<input>what is the fibonacci sequence?</input>
<decision_basis>Conceptual question, no action verb, no target to act on.</decision_basis>
<intent>CHAT</intent>
<confidence>0.95</confidence>
</example>
<example>
<input>what are your skills, tools, and features?</input>
<decision_basis>Capability and tool question; no execution requested.</decision_basis>
<intent>CHAT</intent>
<confidence>0.98</confidence>
</example>
<example>
<input>write a python function that sorts a list</input>
<decision_basis>Action verb 'write' with identifiable target 'a python function that sorts a list'.</decision_basis>
<intent>TASK</intent>
<confidence>0.95</confidence>
</example>
<example>
<input>fix the bug</input>
<decision_basis>Action verb 'fix' present but target is unspecified.</decision_basis>
<intent>HYBRID_INTERACTIVE</intent>
<confidence>0.92</confidence>
</example>
<example>
<input>why did you run the tests?</input>
<decision_basis>Retrospective explanation request; 'run' and 'tests' are discussed rather than requested.</decision_basis>
<intent>CHAT</intent>
<confidence>0.99</confidence>
</example>
<example>
<input>can you run the tests?</input>
<decision_basis>Question-shaped execution request with an identifiable operation.</decision_basis>
<intent>TASK</intent>
<confidence>0.97</confidence>
</example>
<example>
<input>would you run the migration?</input>
<decision_basis>Permission-shaped question whose requested outcome is execution.</decision_basis>
<intent>TASK</intent>
<confidence>0.97</confidence>
</example>
<example>
<input>should i run the tests?</input>
<decision_basis>Advice request addressed to the user; NALA is not asked to execute.</decision_basis>
<intent>CHAT</intent>
<confidence>0.98</confidence>
</example>
<example>
<input>don't run the tests</input>
<decision_basis>Explicit prohibition; no execution request is made.</decision_basis>
<intent>CHAT</intent>
<confidence>0.98</confidence>
</example>
<example>
<input>optimize this</input>
<decision_basis>Action verb 'optimize' but 'this' has no resolvable referent without prior context.</decision_basis>
<intent>HYBRID_INTERACTIVE</intent>
<confidence>0.90</confidence>
</example>
<example>
<history><user>The authentication bug is in auth.py.</user></history>
<input>now fix it</input>
<decision_basis>Target 'auth.py' resolved from conversation history.</decision_basis>
<intent>TASK</intent>
<confidence>0.92</confidence>
</example>
</examples>

<history>
{formatted_history}
</history>

<immediate_request>
Classify the following user message:
{user_message}
</immediate_request>

<thinking_instruction>
Determine:
1. Is an action being requested?
2. Is there an identifiable target?
3. Does conversation history resolve a missing target?
4. Would immediate execution risk touching the wrong target?
Return a concise decision basis. Do NOT output hidden chain-of-thought.
</thinking_instruction>

<output_format>
Return ONLY this structure, nothing else:
<decision_basis>one or two sentences</decision_basis>
<intent>CHAT | TASK | HYBRID_INTERACTIVE</intent>
<confidence>0.0-1.0</confidence>
</output_format>

</system_prompt>"""


# ============================================================================
# 6. Strict Output Parser & Validator
# ============================================================================

def parse_and_validate_viveka_output(raw_output: str) -> IntentResult:
    """
    Parse and validate raw model output.
    Enforces that invalid or malformed output NEVER becomes a TASK.
    """
    if not raw_output or not isinstance(raw_output, str):
        return _safe_fallback("Empty or non-string output from model.")

    # STRICT WHOLE-RESPONSE PROTOCOL ENFORCEMENT (Design A):
    # The output must adhere strictly to the 3-block structure:
    # <decision_basis>...</decision_basis>
    # <intent>CHAT|TASK|HYBRID_INTERACTIVE</intent>
    # <confidence>0.0-1.0</confidence>
    # No markdown fences, no unauthorized preamble, no trailing prose.
    whole_response_pattern = re.compile(
        r"^(?:```(?:xml)?\s*)?"
        r"<decision_basis>(?P<basis>.*?)</decision_basis>\s*"
        r"<intent>(?P<intent>[A-Za-z_]+)</intent>\s*"
        r"<confidence>(?P<confidence>[0-9.]+)</confidence>"
        r"(?:\s*```)?$",
        re.DOTALL | re.IGNORECASE,
    )

    text = raw_output.strip()

    match = whole_response_pattern.match(text)
    if not match:
        # Fails full-document protocol validation -> safe fallback to CHAT
        return _safe_fallback(f"Response violates strict whole-response protocol structure: {text[:100]}")

    raw_intent = match.group("intent").strip().upper()
    basis = match.group("basis").strip()
    raw_conf = match.group("confidence").strip()

    # Parse and strictly validate confidence (0.0 <= confidence <= 1.0)
    try:
        val = float(raw_conf)
        if val < 0.0 or val > 1.0:
            return _safe_fallback(f"Confidence {val} is out of valid range [0.0, 1.0].")
        confidence = val
    except ValueError:
        return _safe_fallback(f"Invalid non-numeric confidence '{raw_conf}'.")

    # Validate intent
    if raw_intent == "CHAT":
        return IntentResult(
            intent=IntentType.CHAT,
            confidence=confidence,
            path="llm",
            decision_basis=basis,
            fallback_used=False,
        )
    elif raw_intent == "TASK":
        return IntentResult(
            intent=IntentType.TASK,
            confidence=confidence,
            path="llm",
            decision_basis=basis,
            fallback_used=False,
        )
    elif raw_intent in ("HYBRID_INTERACTIVE", "HYBRID"):
        return IntentResult(
            intent=IntentType.HYBRID_INTERACTIVE,
            confidence=confidence,
            path="llm",
            decision_basis=basis,
            fallback_used=False,
        )
    else:
        # Unknown intent (e.g. <intent>RUN</intent>) -> Safe fallback to CHAT
        return _safe_fallback(f"Invalid intent '{raw_intent}' returned by model.")


def _safe_fallback(reason: str, prompt: str = "") -> IntentResult:
    """Safe fallback that guarantees infrastructure/parsing failure NEVER produces TASK."""
    logger.warning("Viveka safe fallback triggered: %s", reason)
    return IntentResult(
        intent=IntentType.CHAT,
        confidence=0.5,
        path="llm",
        decision_basis=f"Safe fallback to CHAT: {reason}",
        fallback_used=True,
    )


# ============================================================================
# 7. LLM Disambiguation Fallback
# ============================================================================

def _llm_classify(
    prompt: str,
    history: Optional[List[Union[Turn, dict]]] = None,
    session_id: Optional[str] = None,
    context: Optional[dict] = None,
) -> IntentResult:
    """Call local Ollama Qwen model with the 10-block Viveka prompt and Block 10 prefill."""
    system_prompt = build_viveka_prompt(
        user_message=prompt,
        history=history,
        session_id=session_id,
        pramana_state=context.get("pramana_state") if context else None,
        tool_list=context.get("tool_list") if context else None,
        prior_intent=context.get("prior_intent") if context else None,
    )

    try:
        url = "http://localhost:11434/api/generate"
        payload = json.dumps({
            "model": "qwen2.5-coder:1.5b",
            "prompt": f"{system_prompt}\n\nAssistant: <decision_basis>",
            "stream": False,
            "keep_alive": "30m",
            "options": {
                "num_predict": 100,
                "temperature": 0.1,
            },
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_text = data.get("response") or ""
            # Re-attach prefilled tag if model output starts immediately with body
            if not raw_text.strip().startswith("<decision_basis>"):
                raw_text = "<decision_basis>" + raw_text
            return parse_and_validate_viveka_output(raw_text)

    except Exception as e:
        return _safe_fallback(f"Ollama call failed or timed out: {e}", prompt=prompt)


# ============================================================================
# 8. Canonical Public Interface
# ============================================================================

def classify_intent(
    prompt: str,
    *,
    force_mode: Optional[str] = None,
    history: Optional[List[Union[Turn, dict]]] = None,
    session_id: Optional[str] = None,
    context: Optional[dict] = None,
) -> IntentResult:
    """
    Authoritative intent classification function for NALA.

    Input:
        prompt: Raw user input.
        force_mode: Optional UI override ('chat' | 'task' | 'hybrid' | 'auto').
        history: Bounded conversation history.
        session_id: Active session identity.
        context: Optional diagnostic session context.

    Returns:
        IntentResult containing (intent, confidence, path, decision_basis).
    """
    # 1. UI Override check
    if force_mode:
        fm = force_mode.strip().lower()
        if fm in ("chat",):
            return IntentResult(
                intent=IntentType.CHAT,
                confidence=1.0,
                path="fast",
                decision_basis="UI force_mode override to CHAT.",
                tier=0,
            )
        if fm in ("task", "work", "agent", "code", "exec"):
            return IntentResult(
                intent=IntentType.TASK,
                confidence=1.0,
                path="fast",
                decision_basis="UI force_mode override to TASK.",
                tier=0,
            )
        if fm in ("hybrid", "hybrid_interactive", "clarify"):
            return IntentResult(
                intent=IntentType.HYBRID_INTERACTIVE,
                confidence=1.0,
                path="fast",
                decision_basis="UI force_mode override to HYBRID_INTERACTIVE.",
                tier=0,
            )

    # 2. Tier 0: Deterministic Fast Path (<1ms)
    fast_result = _fast_path_classify(prompt, history=history)
    if fast_result is not None:
        return fast_result

    # 3. Tier 1: LLM Fallback with strict validation
    return _llm_classify(prompt, history=history, session_id=session_id, context=context)


# ============================================================================
# 9. Legacy Helper Exports
# ============================================================================

def score_complexity(prompt: str) -> float:
    """0.0–1.0 complexity for model routing."""
    text = prompt.strip()
    if not text:
        return 0.0
    tokens = max(1, len(text.split()))
    score = min(0.35, tokens / 80.0)
    depth = text.count("(") + text.count("[") + text.count("{")
    score += min(0.2, depth * 0.04)
    if _EXPLICIT_FILE_OR_PATH_PATTERN.search(text):
        score += 0.25
    return max(0.0, min(1.0, score))


def select_ollama_model(
    prompt: str,
    intent: Literal["chat", "task", "hybrid_interactive"] = "chat",
) -> Tuple[str, int, float]:
    """Returns (model_name, num_predict, timeout_seconds)."""
    c = score_complexity(prompt)
    if intent in ("chat", "hybrid_interactive"):
        if c < 0.3:
            return "qwen2.5-coder:1.5b", 60, 45.0
        if c < 0.7:
            return "qwen2.5-coder:3b", 120, 60.0
        return "qwen2.5-coder:7b", 180, 75.0

    # task
    if c < 0.3:
        return "qwen2.5-coder:3b", 150, 60.0
    if c < 0.7:
        return "qwen2.5-coder:7b", 250, 75.0
    return "qwen2.5-coder:7b", 350, 90.0


def curate_thought(internal: str, max_len: int = 120) -> str:
    """Map internal monitoring language to short user-facing text."""
    text = (internal or "").strip()
    if not text:
        return "Working on your request…"
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


STEP_USER_LABELS = {
    "initial_planning": {
        "title": "Planning",
        "details": [
            "Analyzing your request",
            "Breaking the work into clear steps",
        ],
    },
    "execution_phase": {
        "title": "Executing",
        "details": [
            "Running work in a safe environment",
            "Gathering results from tools",
        ],
    },
    "reflection_synthesis": {
        "title": "Verifying",
        "details": [
            "Checking results",
            "Preparing the final answer",
        ],
    },
}
