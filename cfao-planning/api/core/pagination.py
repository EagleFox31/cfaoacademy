"""Pagination par curseur calée sur `created_at` (tous les ScopedModel le portent)."""
from rest_framework.pagination import CursorPagination


class TimestampCursorPagination(CursorPagination):
    ordering = "-created_at"
    page_size = 25
