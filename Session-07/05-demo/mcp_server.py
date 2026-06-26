"""Tiny MCP server exposing the same two tools as demo_01 (the clean A/B)."""
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("support-tools")

ORDERS = {"A7731": {"status": "delivered", "delivered_on": "2026-06-22",
                    "items": [{"sku": "AZ-4471", "name": "Wireless Earbuds", "opened": True}]}}
POLICY = ("Returns: sealed items within 30 days for full refund. "
          "Unsealed/opened items may be exchanged within 14 days of delivery, no cash refund.")

@mcp.tool()
def get_order(order_id: str) -> dict:
    """Look up an order by its ID; returns status, delivery date, and line items."""
    return ORDERS.get(order_id, {"error": "order not found"})

@mcp.tool()
def get_policy(topic: str) -> str:
    """Retrieve the relevant returns/exchange policy clause for a topic."""
    return POLICY

if __name__ == "__main__":
    mcp.run()
