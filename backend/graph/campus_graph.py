from graph.node import Node
from graph.edge import Edge

class CampusGraph:
    def __init__(self):
        self.nodes = {}  # node_id -> Node
        self.edges = []  # list of all edges
        self.adjacency = {}  # node_id -> list of edges

    def add_node(self, node):
        self.nodes[node.node_id] = node
        self.adjacency[node.node_id] = []

    def add_edge(self, edge):
        self.edges.append(edge)
        # add edge in both directions since paths are walkable both ways
        self.adjacency[edge.start_node.node_id].append(edge)

        # create reverse edge
        reverse = Edge(
            edge_id=edge.edge_id + "_rev",
            start_node=edge.end_node,
            end_node=edge.start_node,
            distance=edge.distance,
            lighting_level=edge.lighting_level,
            report_count=edge.report_count
        )
        self.adjacency[edge.end_node.node_id].append(reverse)

    def get_node(self, node_id):
        return self.nodes.get(node_id)

    def get_neighbors(self, node_id):
        return self.adjacency.get(node_id, [])

    def update_report_count(self, start_id, end_id, count):
        # update safety weight when new reports come in from database
        for edge in self.adjacency.get(start_id, []):
            if edge.end_node.node_id == end_id:
                edge.report_count = count

    def __repr__(self):
        return f"CampusGraph({len(self.nodes)} nodes, {len(self.edges)} edges)"