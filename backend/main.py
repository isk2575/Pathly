from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from graph.node import Node
from graph.edge import Edge
from graph.campus_graph import CampusGraph
from graph.route_engine import RouteEngine

app = FastAPI()

# allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Build UH Campus Graph ───────────────────────────────────────────

graph = CampusGraph()

# --- Nodes (UH campus locations) ---
nodes = [
    Node("n1", "MD Anderson Library",        29.7210, -95.3420, lighting_level=8, has_blue_light=True),
    Node("n2", "Student Center",              29.7197, -95.3432, lighting_level=7, has_blue_light=True),
    Node("n3", "Science Building",            29.7220, -95.3415, lighting_level=6, has_blue_light=False),
    Node("n4", "Cougar Village",              29.7178, -95.3408, lighting_level=5, has_blue_light=True),
    Node("n5", "Athletics / TDECU Stadium",   29.7235, -95.3445, lighting_level=7, has_blue_light=False),
    Node("n6", "Parking Garage",              29.7188, -95.3398, lighting_level=4, has_blue_light=True),
    Node("n7", "CT Bauer College",            29.7205, -95.3410, lighting_level=7, has_blue_light=False),
    Node("n8", "Cullen Family Plaza",         29.7215, -95.3435, lighting_level=9, has_blue_light=True),
    Node("n9", "Moody Towers",                29.7182, -95.3420, lighting_level=6, has_blue_light=False),
    Node("n10", "UH Welcome Center",          29.7193, -95.3425, lighting_level=8, has_blue_light=True),
]

for node in nodes:
    graph.add_node(node)

# --- Edges (paths between locations) ---
edges = [
    Edge("e1",  graph.get_node("n1"),  graph.get_node("n2"),  120, lighting_level=8, report_count=0),
    Edge("e2",  graph.get_node("n1"),  graph.get_node("n3"),   80, lighting_level=6, report_count=0),
    Edge("e3",  graph.get_node("n2"),  graph.get_node("n10"), 100, lighting_level=7, report_count=0),
    Edge("e4",  graph.get_node("n2"),  graph.get_node("n5"),  200, lighting_level=5, report_count=1),
    Edge("e5",  graph.get_node("n3"),  graph.get_node("n7"),   90, lighting_level=7, report_count=0),
    Edge("e6",  graph.get_node("n4"),  graph.get_node("n9"),  150, lighting_level=4, report_count=2),
    Edge("e7",  graph.get_node("n4"),  graph.get_node("n10"), 130, lighting_level=6, report_count=0),
    Edge("e8",  graph.get_node("n5"),  graph.get_node("n8"),  180, lighting_level=8, report_count=0),
    Edge("e9",  graph.get_node("n6"),  graph.get_node("n9"),  110, lighting_level=4, report_count=3),
    Edge("e10", graph.get_node("n7"),  graph.get_node("n8"),   95, lighting_level=9, report_count=0),
    Edge("e11", graph.get_node("n8"),  graph.get_node("n1"),  140, lighting_level=9, report_count=0),
    Edge("e12", graph.get_node("n9"),  graph.get_node("n10"), 120, lighting_level=6, report_count=1),
    Edge("e13", graph.get_node("n10"), graph.get_node("n6"),  160, lighting_level=5, report_count=0),
]

for edge in edges:
    graph.add_edge(edge)

engine = RouteEngine(graph)

# ─── API Routes ──────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Pathly routing engine is running"}

@app.get("/nodes")
def get_nodes():
    return [
        {
            "id": node.node_id,
            "name": node.name,
            "lat": node.lat,
            "lng": node.lng,
            "lighting_level": node.lighting_level,
            "has_blue_light": node.has_blue_light,
        }
        for node in graph.nodes.values()
    ]

@app.get("/route/safest")
def get_safest_route(start: str, end: str):
    result = engine.find_safest_route(start, end)
    if result is None:
        return {"error": "No route found"}
    return {
        "preference": "safest",
        "total_cost": result["total_cost"],
        "path": [
            {
                "id": node.node_id,
                "name": node.name,
                "lat": node.lat,
                "lng": node.lng,
            }
            for node in result["nodes"]
        ]
    }

@app.get("/route/fastest")
def get_fastest_route(start: str, end: str):
    result = engine.find_fastest_route(start, end)
    if result is None:
        return {"error": "No route found"}
    return {
        "preference": "fastest",
        "total_cost": result["total_cost"],
        "path": [
            {
                "id": node.node_id,
                "name": node.name,
                "lat": node.lat,
                "lng": node.lng,
            }
            for node in result["nodes"]
        ]
    }